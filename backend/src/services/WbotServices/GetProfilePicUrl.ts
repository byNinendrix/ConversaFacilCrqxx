import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";
import buildBackendBaseUrl from "../../helpers/buildBackendBaseUrl";

const GetProfilePicUrl = async (
  number: string,
  companyId: number
): Promise<string> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(companyId);

  const wbot = getWbot(defaultWhatsapp.id);

  let profilePicUrl: string;
  try {
    profilePicUrl = await wbot.profilePictureUrl(`${number}@s.whatsapp.net`);
  } catch (error) {
    const backendUrl = buildBackendBaseUrl();
    profilePicUrl = `${backendUrl}/nopicture.png`;
  }

  return profilePicUrl;
};

export default GetProfilePicUrl;
