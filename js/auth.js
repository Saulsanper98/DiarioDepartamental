const MSAL_CDN_URL = "https://cdn.jsdelivr.net/npm/@azure/msal-browser@3.23.0/lib/msal-browser.min.js";
const LOCAL_STORAGE_ACCOUNT_KEY = "msal_account";

let msalLibraryPromise = null;

function loadMsalFromCdn() {
  if (window.msal) {
    return Promise.resolve(window.msal);
  }

  if (msalLibraryPromise) {
    return msalLibraryPromise;
  }

  msalLibraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = MSAL_CDN_URL;
    script.async = true;
    script.onload = () => {
      if (window.msal) {
        resolve(window.msal);
        return;
      }
      reject(new Error("MSAL no se pudo cargar desde CDN."));
    };
    script.onerror = () => reject(new Error("Error cargando MSAL desde CDN."));
    document.head.appendChild(script);
  });

  return msalLibraryPromise;
}

export const msalConfig = {
  auth: {
    clientId: "66f4752b-5ae2-467c-ba41-bfe9d8ff623b",
    authority: "https://login.microsoftonline.com/975aa926-1bfc-4b7f-a272-f1504217728f",
    redirectUri: window.location.origin,
  },
};

export const loginRequest = {
  scopes: ["User.Read", "openid", "profile", "email"],
};

export let msalInstance = null;

function persistAccount(account) {
  if (!account) {
    return;
  }
  localStorage.setItem(LOCAL_STORAGE_ACCOUNT_KEY, JSON.stringify(account));
}

function getStoredAccount() {
  const rawAccount = localStorage.getItem(LOCAL_STORAGE_ACCOUNT_KEY);
  if (!rawAccount) {
    return null;
  }
  try {
    return JSON.parse(rawAccount);
  } catch {
    return null;
  }
}

function findMatchingAccount(account) {
  if (!account || !msalInstance) {
    return null;
  }

  const allAccounts = msalInstance.getAllAccounts();
  return (
    allAccounts.find((item) => item.homeAccountId === account.homeAccountId) ||
    allAccounts.find((item) => item.localAccountId === account.localAccountId) ||
    null
  );
}

export async function initMSAL() {
  try {
    const msal = await loadMsalFromCdn();
    msalInstance = new msal.PublicClientApplication(msalConfig);

    // CRITICO: inicializar antes de cualquier otra llamada
    await msalInstance.initialize();

    // Manejar el redirect de vuelta desde Microsoft
    const response = await msalInstance.handleRedirectPromise();

    if (response) {
      // Venimos de un redirect de Microsoft con cuenta
      msalInstance.setActiveAccount(response.account);
      localStorage.setItem("msal_account", JSON.stringify(response.account));
      return response.account;
    }

    // Comprobar si ya hay cuenta activa
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      msalInstance.setActiveAccount(accounts[0]);
      localStorage.setItem("msal_account", JSON.stringify(accounts[0]));
      return accounts[0];
    }

    // No hay cuenta - redirigir a Microsoft login
    await msalInstance.loginRedirect(loginRequest);
    return null; // La pagina se va a redirigir
  } catch (err) {
    console.error("Error initMSAL:", err);
    throw err;
  }
}

export async function getToken() {
  if (!msalInstance) throw new Error('MSAL no inicializado');
  
  const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];
  if (!account) throw new Error('No hay cuenta activa');

  try {
    const response = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account: account,
    });
    return response.accessToken;
  } catch (err) {
    console.warn('acquireTokenSilent fallo, intentando redirect:', err);
    await msalInstance.acquireTokenRedirect({
      ...loginRequest,
      account: account,
    });
    return null;
  }
}

export async function getAuthHeaders() {
  try {
    const token = await getToken();
    if (!token) return { 'Content-Type': 'application/json' };
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  } catch (err) {
    console.error('Error obteniendo token:', err);
    return { 'Content-Type': 'application/json' };
  }
}

async function getPhoto(token) {
  try {
    const response = await fetch("https://graph.microsoft.com/v1.0/me/photo/$value", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("No se pudo procesar la foto del usuario."));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const token = await getToken();
  
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!res.ok) throw new Error('Error obteniendo usuario de Graph');
  const user = await res.json();

  // Intentar obtener foto - ignorar si falla
  let photo = null;
  try {
    const photoRes = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (photoRes.ok) {
      const blob = await photoRes.blob();
      photo = URL.createObjectURL(blob);
    }
  } catch {
    // Sin foto, no es critico
  }

  return {
    userId: user.id,
    name: user.displayName,
    email: user.mail || user.userPrincipalName,
    department: user.department || null,
    jobTitle: user.jobTitle || null,
    photo,
  };
}

export function logout() {
  if (msalInstance) {
    msalInstance.logoutRedirect();
  }
  localStorage.clear();
}
