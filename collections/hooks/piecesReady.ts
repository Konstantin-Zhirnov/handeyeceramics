import type { CollectionAfterChangeHook } from "payload";
import { inBackground, sendPiecesReady } from "../../lib/mail";

/**
 * When the owner ticks "Pieces are ready for pickup" on a class date, every
 * confirmed student of that date gets the "pieces ready" email — in the
 * background, so the save in the admin does not wait for the mail adapter.
 * The letters go out once: the tick must be new and the date not marked sent
 * yet; `sendPiecesReady` marks the date when it is done (with the
 * `piecesReadyMail` context, so that write does not come back here).
 */
export const piecesReadyMail: CollectionAfterChangeHook = async ({ doc, previousDoc, req, context }) => {
  if (context?.piecesReadyMail) return doc;
  const ticked = doc.piecesReady === true && !doc.piecesReadySentAt && previousDoc?.piecesReady !== true;
  if (!ticked) return doc;
  const { payload } = req;
  const sending = sendPiecesReady(doc.id as number, payload).catch((err) => {
    payload.logger.error({ msg: "Pieces-ready emails were not sent", session: doc.id, err });
  });
  await inBackground(sending);
  return doc;
};
