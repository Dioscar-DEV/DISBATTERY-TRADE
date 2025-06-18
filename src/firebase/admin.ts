import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

// Tu configuración de servicio (las credenciales que me pasaste)
const serviceAccount = {
  type: "service_account",
  project_id: "disbattery-trade",
  private_key_id: "6733077fd540db3a55a9cb813043bece5fd71912",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDgFv2Pc5/Aiwa6\nYMG1G7wV/HNjaKLTO2UJ5WRuKdVRl/A0a++kVSY3YQNZNxryqW3dwas1HHkYtdHx\ng92+f3ESJSgMe82/i7BSWSfEuThM7nGITZSm2GZhKih2MzR5PlWd5EugSFl3lJby\nfhXrGuDymF2r6avEkai3kWQGrUvdL1niydTYRt+eHRuoLpLJvl7R9GwZU/s6QaYx\nbcvfC0GPwCqO4BH7BxLCxAoCWYIR9xKqVclPiGbUjUEa+ExwowVFjnCHxzKY/bZ9\nfMRoUxbZYmM1pQ0gHx5Phh8T/lr1deaSJXrtejwp68+lq3UHmcjrPEVSALeGhLN9\ne802hplHAgMBAAECggEAG4S3PpaEV7C68shPAV6WilymDt8an7X7gmuZGa4pdAuk\ng8t9ckDCoKpZLuuFc6c6xrCxxaPpew9Y6L+4y1v7Fq9Za68IZS1SScqJB693Kntd\nlc9xIcwRRn1W2q0PFJSDDxCp+NTpp7Wnk7/IEUcLuL7dQe9AGLOKdIB2OBuv5Ulg\ne+RmoPiMdhur3jeOCYRQYStTanGZ0EUmY90sQ4HPSxfW/H93FnQQV4O2eqn3fZ7E\npeqvpKImF0NVAueqVhV46hN/IsSMdlqzKxjXTOL2bxqmZ6vbcYOb5CBglFYwYVJR\nocoXAKZCjfaV5IMKvNrBCeTbjjFvKXqwJANUV+QYAQKBgQDyY2I2UiORMyW42x16\n5NEg8cisEuJbDdxckHBQv2lgc2NWdpGYCJCUbjh7ZyuFYCDJrGY3Y1osWHofrjyM\ndvphsAxoXlGu6UoQoEiwKFQNJWuyKb+slNCtfnU+fdl+IOAFpmMJ6ZEH6zfAOCqq\n+le8w37Lv4nY/cUTzrr5csfZwQKBgQDsrIusmoWdWOUAQoZFKAho9jEz4aPgPbuY\nvN5uYNa4flzDKWfPQwfWAnnOyPh6rAogIJC6qPFSnV2OJA9OCvgRBZcdVqNYFD7L\n2cSLKUaxlutRzLb2xFaqlyosx0vmxTsxNCp+7JYk15r/zm15IfM6Uk3XoVHM4gJ/\nqQtgYsblBwKBgB7z5AnNyW70Wh/WE1irOa18UsTukGtSRM6pPz6AgwNnGMtkzsjc\nZyIdRSc1EJCyqt02H8N4833wOoArLt49H1I0OhFl4gZ1Ehk3brDYJYucOLmCrVBr\nnI5bNLurNIfvyMvP6JvOcM/TEMaCJai52VRonpuENSU5mt4hqyzJpI3BAoGAd8L8\nTtRGZo/UGaSQIzCVyN9DmJhGf7NdWXXBLKOOI/+1WwB5ylSGA5JvJudlbVXfLdCs\ny/evXfnJnKK8p+Y/DwYAKNVthKWB/U9t+Gljn3vaCiOINii2Hk6uBci3rMgDIuvd\n0SpQ88WyZl2D4fb/CHUbdNDp/r4jO4xD+HsjYEMCgYEA5JLan6aY0AVUkPKNz1re\nevH4VflVCrha546rzvLU6SiruC0UZyh4AjggOLCX8Ffxyqs+lJoUyt9vrYjKslLo\nL+eXvG1aZ3cEAkJFYNTgCFMVNqkgneRQnvrYZ2Rk5Vqr/POjJhKOO/BJJyBEyfYG\nrw22gebRYhDTC2yK0MDZeKg=\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@disbattery-trade.iam.gserviceaccount.com",
  client_id: "115275550448214389336",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40disbattery-trade.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

// Inicializar Firebase Admin
let adminApp: App;

if (!getApps().length) {
  adminApp = initializeApp({
    credential: cert(serviceAccount as any),
    projectId: 'disbattery-trade'
  });
} else {
  adminApp = getApps()[0];
}

// Servicios de Admin
const adminAuth: Auth = getAuth(adminApp);
const adminDb: Firestore = getFirestore(adminApp);

export { adminApp, adminAuth, adminDb }; 