/* Payload admin shell — the standard Payload 3 layout. */
import config from "@payload-config";
import "@payloadcms/next/css";
import type { ServerFunctionClient } from "payload";
import { handleServerFunctions, RootLayout } from "@payloadcms/next/layouts";
import { Bodoni_Moda, Karla } from "next/font/google";
import React from "react";

import { importMap } from "./admin/importMap.js";
import "./custom.scss";

type Args = { children: React.ReactNode };

// The public site's two faces (app/(site)/layout.tsx); custom.scss hands them to Payload's --font-body and the headings.
const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-bodoni",
  style: ["normal"],
  axes: ["opsz"],
  display: "swap",
});

const karla = Karla({
  subsets: ["latin"],
  variable: "--font-karla",
  display: "swap",
});

const serverFunction: ServerFunctionClient = async function (args) {
  "use server";
  return handleServerFunctions({ ...args, config, importMap });
};

const Layout = ({ children }: Args) => (
  <RootLayout
    config={config}
    htmlProps={{ className: `${bodoni.variable} ${karla.variable}` }}
    importMap={importMap}
    serverFunction={serverFunction}
  >
    {children}
  </RootLayout>
);

export default Layout;
