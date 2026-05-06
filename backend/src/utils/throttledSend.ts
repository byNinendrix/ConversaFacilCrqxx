import { WASocket } from "@whiskeysockets/baileys";

const S_MIN = Number(process.env.SEND_MIN_MS ?? 300);   // atraso mínimo por envio
const S_MAX = Number(process.env.SEND_MAX_MS ?? 1200);  // atraso máximo por envio
const jitter = (min:number, max:number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

// Para campanhas / automações
export const makeThrottledSender = (sock: WASocket) => {
  return async (jid: string, content: any) => {
    const wait = jitter(S_MIN, S_MAX);
    await new Promise(r => setTimeout(r, wait));
    return sock.sendMessage(jid, content);
  };
};

// Para mensagens “humanas”/pontuais
export const makeInstantSender = (sock: WASocket) => {
  return (jid: string, content: any) => sock.sendMessage(jid, content);
};
