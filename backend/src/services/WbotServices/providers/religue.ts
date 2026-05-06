import { proto, WASocket } from "@whiskeysockets/baileys";
import Contact from "../../../models/Contact";
import Ticket from "../../../models/Ticket";
import { getBodyMessage, isNumeric, sleep, validaCpfCnpj } from "../wbotMessageListener";
import formatBody from "../../../helpers/Mustache";

import axios from "axios";
import UpdateTicketService from "../../TicketServices/UpdateTicketService";
import { loadProviderSettings, sanitizeCpfCnpj } from "./shared";

export const runTrustReconnectScenario = async (
  ticket: Ticket,
  msg: proto.IWebMessageInfo,
  companyId: number,
  contact: Contact,
  wbot: WASocket
) => {
  let cpfcnpj = sanitizeCpfCnpj(getBodyMessage(msg));

  const providerSettings = await loadProviderSettings(companyId);
  const ixcApiKey = providerSettings.tokenixc;
  const urlixc = providerSettings.ipixc;
  const ixckeybase64 = btoa(ixcApiKey);
  const destination = `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;

  let numberCPFCNPJ = cpfcnpj;

  const sendMessageWithDelay = async (text: string) => {
    await sleep(2000);
    await wbot.sendMessage(destination, {
      text: formatBody(text, contact)
    });
  };

  if (ixcApiKey === "" || urlixc === "") {
    return;
  }

  if (!isNumeric(numberCPFCNPJ) || cpfcnpj.length <= 2) {
    return;
  }

  const isCPFCNPJ = validaCpfCnpj(numberCPFCNPJ);
  if (!isCPFCNPJ) {
    await sendMessageWithDelay(`Este CPF/CNPJ nÃ£o Ã© vÃ¡lido!\n\nPor favor tente novamente!\nOu digite *#* para voltar ao *Menu Anterior*`);
    return;
  }

  if (numberCPFCNPJ.length <= 11) {
    numberCPFCNPJ = numberCPFCNPJ.replace(/(\d{3})(\d)/, "$1.$2");
    numberCPFCNPJ = numberCPFCNPJ.replace(/(\d{3})(\d)/, "$1.$2");
    numberCPFCNPJ = numberCPFCNPJ.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  } else {
    numberCPFCNPJ = numberCPFCNPJ.replace(/^(\d{2})(\d)/, "$1.$2");
    numberCPFCNPJ = numberCPFCNPJ.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
    numberCPFCNPJ = numberCPFCNPJ.replace(/\.(\d{3})(\d)/, ".$1/$2");
    numberCPFCNPJ = numberCPFCNPJ.replace(/(\d{4})(\d)/, "$1-$2");
  }

  try {
    await sendMessageWithDelay(`Aguarde! Estamos consultando na base de dados!`);
  } catch (error) {
    // mantém comportamento anterior: ignorar erro de envio inicial
  }

  const options = {
    method: "GET",
    url: `${urlixc}/webservice/v1/cliente`,
    headers: {
      ixcsoft: "listar",
      Authorization: `Basic ${ixckeybase64}`
    },
    data: {
      qtype: "cliente.cnpj_cpf",
      query: numberCPFCNPJ,
      oper: "=",
      page: "1",
      rp: "1",
      sortname: "cliente.cnpj_cpf",
      sortorder: "asc"
    }
  };

  try {
    const responseCliente = await axios.request(options as any);

    if (responseCliente.data.type === "error") {
      await sendMessageWithDelay(`*Opss!!!!*\nOcorreu um erro! Digite *#* e fale com um *Atendente*!`);
    }

    if (responseCliente.data.total === 0) {
      try {
        await sendMessageWithDelay(`Cadastro nÃ£o localizado! *CPF/CNPJ* incorreto ou invÃ¡lido. Tenta novamente!`);
      } catch (error) {
        // mantém comportamento anterior: ignorar falha de envio
      }
      return;
    }

    const nome = responseCliente.data?.registros[0]?.razao;
    const id = responseCliente.data?.registros[0]?.id;

    await sendMessageWithDelay(`Localizei seu Cadastro! \n*${nome}* sÃ³ mais um instante por favor!`);

    const optionsContrato = {
      method: "POST",
      url: `${urlixc}/webservice/v1/cliente_contrato`,
      headers: {
        ixcsoft: "listar",
        Authorization: `Basic ${ixckeybase64}`
      },
      data: {
        qtype: "cliente_contrato.id_cliente",
        query: id,
        oper: "=",
        page: "1",
        rp: "1",
        sortname: "cliente_contrato.id",
        sortorder: "asc"
      }
    };

    try {
      const responseContrato = await axios.request(optionsContrato as any);
      const statusInternet = responseContrato.data?.registros[0]?.status_internet;
      const idContrato = responseContrato.data?.registros[0]?.id;

      if (statusInternet !== "A") {
        await sendMessageWithDelay(`*${nome}*  a sua conexÃ£o esta bloqueada! Vou desbloquear para vocÃª.`);
        await sendMessageWithDelay(`Estou liberando seu acesso. Por favor aguarde!`);

        const optionsDesbloqueio = {
          method: "POST",
          url: `${urlixc}/webservice/v1/desbloqueio_confianca`,
          headers: {
            Authorization: `Basic ${ixckeybase64}`
          },
          data: { id: idContrato }
        };

        try {
          const responseDesbloqueio = await axios.request(optionsDesbloqueio as any);
          const tipo = responseDesbloqueio.data?.tipo;
          const mensagem = responseDesbloqueio.data?.mensagem;

          if (tipo === "sucesso") {
            const optionsRadius = {
              method: "GET",
              url: `${urlixc}/webservice/v1/radusuarios`,
              headers: {
                ixcsoft: "listar",
                Authorization: `Basic ${ixckeybase64}`
              },
              data: {
                qtype: "radusuarios.id_cliente",
                query: id,
                oper: "=",
                page: "1",
                rp: "1",
                sortname: "radusuarios.id",
                sortorder: "asc"
              }
            };

            try {
              const responseRadius = await axios.request(optionsRadius as any);
              const tipoRadius = responseRadius.data?.type;

              if (tipoRadius === "success") {
                await sendMessageWithDelay(`${mensagem}`);
                await sendMessageWithDelay(`Fiz os procedimentos de liberaÃ§Ã£o! Agora aguarde atÃ© 5 minutos e veja se sua conexÃ£o irÃ¡ retornar! .\n\nCaso nÃ£o tenha voltado, retorne o contato e fale com um atendente!`);
                await sendMessageWithDelay(`Estamos finalizando esta conversa! Caso precise entre em contato conosco!`);
                await UpdateTicketService({
                  ticketData: { status: "closed" },
                  ticketId: ticket.id,
                  companyId: ticket.companyId
                });
              } else {
                await sendMessageWithDelay(`${mensagem}`);
                await sendMessageWithDelay(`Vou precisar que vocÃª *retire* seu equipamento da tomada.\n\n*OBS: Somente retire da tomada.* \nAguarde 1 minuto e ligue novamente!`);
                await sendMessageWithDelay(`Veja se seu acesso voltou! Caso nÃ£o tenha voltado retorne o contato e fale com um atendente!`);
                await sendMessageWithDelay(`Estamos finalizando esta conversa! Caso precise entre em contato conosco!`);
                await UpdateTicketService({
                  ticketData: { status: "closed" },
                  ticketId: ticket.id,
                  companyId: ticket.companyId
                });
              }
            } catch (error) {
              console.error(error);
            }
          } else {
            await sendMessageWithDelay(`Ops! Ocorreu um erro e nao consegui desbloquear!`);
            await sendMessageWithDelay(`${mensagem}`);
            await sendMessageWithDelay(`Digite *#* e fale com um atendente!`);
          }
        } catch (error) {
          await sendMessageWithDelay(`Ops! Ocorreu um erro digite *#* e fale com um atendente!`);
        }
      } else {
        await sendMessageWithDelay(`Sua ConexÃ£o nÃ£o estÃ¡ bloqueada! Caso esteja com dificuldades de navegaÃ§Ã£o, retorne o contato e fale com um atendente!`);
        await sendMessageWithDelay(`Estamos finalizando esta conversa! Caso precise entre em contato conosco!`);
        await UpdateTicketService({
          ticketData: { status: "closed" },
          ticketId: ticket.id,
          companyId: ticket.companyId
        });
      }
    } catch (error) {
      await sendMessageWithDelay(`Ops! Ocorreu um erro digite *#* e fale com um atendente!`);
    }
  } catch (error) {
    await sendMessageWithDelay(`*Opss!!!!*\nOcorreu um erro! Digite *#* e fale com um *Atendente*!`);
  }
};
