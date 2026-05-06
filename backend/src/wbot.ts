import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  WASocket
} from '@whiskeysockets/baileys'
import pino from 'pino'

export const startWbot = async (): Promise<WASocket> => {
  // Diretório onde as credenciais ficarão salvas
  const { state, saveCreds } = await useMultiFileAuthState('./.wbot_auth')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'warn' }),
    printQRInTerminal: true,
    syncFullHistory: false
  })

  // Atualiza credenciais sempre que mudar
  sock.ev.on('creds.update', saveCreds)

  // Logs de conexão
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection) console.log(`[wbot] Conexão: ${connection}`)
    if (lastDisconnect?.error) {
      console.log('[wbot] Última desconexão:',
        (lastDisconnect.error as any)?.output?.statusCode)
    }
  })

  return sock
}
