import path from "path";
import { fileURLToPath } from "url";
import { buildConfig, type EmailAdapter, type Field, type Plugin } from "payload";
import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { redirectsPlugin } from "@payloadcms/plugin-redirects";
import { vercelBlobStorage } from "@payloadcms/storage-vercel-blob";
import { nodemailerAdapter } from "@payloadcms/email-nodemailer";
import { muxVideoPlugin } from "@oversightstudio/mux-video";
import sharp from "sharp";

import {
  Classes,
  Enquiries,
  Media,
  Pages,
  Plans,
  Products,
  Studios,
  Users,
  videosCollection,
} from "./collections";
import { Home, Settings } from "./globals";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const env = process.env;

// ---- Database: postgres:// → Postgres, anything else → SQLite file ----------
const databaseURI = env.DATABASE_URI || "file:./handeye.db";
const usePostgres = /^postgres(ql)?:\/\//i.test(databaseURI);
const db = usePostgres
  ? postgresAdapter({ pool: { connectionString: databaseURI } })
  : sqliteAdapter({ client: { url: databaseURI } });

// ---- Secret: the fallback is for local development on SQLite only ---------
// `next build` runs with NODE_ENV=production but serves nothing, so it may use the fallback.
const isBuildStep = env.NEXT_PHASE === "phase-production-build";
const isProduction =
  !isBuildStep && (env.NODE_ENV === "production" || env.SITE_ENV === "production");
const secret =
  env.PAYLOAD_SECRET ||
  (usePostgres || isProduction ? "" : "local-sqlite-only-" + path.basename(dirname));
if (!secret) {
  throw new Error(
    "PAYLOAD_SECRET is required with Postgres and whenever NODE_ENV or SITE_ENV is production",
  );
}

// ---- Optional services, each switched on only by its env variables ---------
const blobEnabled = Boolean(env.BLOB_READ_WRITE_TOKEN);
const muxEnabled = Boolean(env.MUX_TOKEN_ID && env.MUX_TOKEN_SECRET);
const smtpEnabled = Boolean(env.SMTP_HOST);
const serverURL = env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3210";

const fromAddress = env.EMAIL_FROM || "noreply@localhost";
const fromName = env.EMAIL_FROM_NAME || "Hand Eye Ceramics";

/** Without SMTP, emails are written to the server log instead of being sent. */
const logEmailAdapter: EmailAdapter = ({ payload }) => ({
  name: "log",
  defaultFromAddress: fromAddress,
  defaultFromName: fromName,
  sendEmail: async (message) => {
    payload.logger.info({ msg: "Email (SMTP not configured, logged only)", to: message.to, subject: message.subject, text: message.text });
    return { logged: true };
  },
});

const email = smtpEnabled
  ? nodemailerAdapter({
      defaultFromAddress: fromAddress,
      defaultFromName: fromName,
      transportOptions: {
        host: env.SMTP_HOST,
        port: Number(env.SMTP_PORT || 587),
        secure: Number(env.SMTP_PORT) === 465,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      },
    })
  : logEmailAdapter;

const plugins: Plugin[] = [
  redirectsPlugin({
    collections: ["pages", "studios", "products"],
    redirectTypes: ["301"],
    overrides: {
      admin: { group: "Addresses" },
      fields: ({ defaultFields }) =>
        defaultFields.map((f) =>
          "name" in f && f.name === "type" ? ({ ...f, defaultValue: "301" } as Field) : f,
        ),
    },
  }),
  vercelBlobStorage({
    enabled: blobEnabled,
    collections: muxEnabled ? { media: true } : { media: true, videos: true },
    token: env.BLOB_READ_WRITE_TOKEN || "",
  }),
  muxVideoPlugin({
    enabled: muxEnabled,
    extendCollection: "videos",
    initSettings: {
      tokenId: env.MUX_TOKEN_ID || "",
      tokenSecret: env.MUX_TOKEN_SECRET || "",
      webhookSecret: env.MUX_WEBHOOK_SIGNING_SECRET || "",
    },
    uploadSettings: { cors_origin: serverURL },
  }),
];

export default buildConfig({
  serverURL: env.NEXT_PUBLIC_SERVER_URL || undefined,
  secret,
  db,
  editor: lexicalEditor(),
  sharp,
  email,
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: { titleSuffix: " — Hand Eye Ceramics admin" },
  },
  collections: [
    Users,
    Media,
    videosCollection(muxEnabled),
    Studios,
    Classes,
    Pages,
    Products,
    Plans,
    Enquiries,
  ],
  globals: [Settings, Home],
  plugins,
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
});
