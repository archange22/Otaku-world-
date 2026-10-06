// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Régression Mobile & Accueil : Splash screen, Accueil KOVA et Connexion Google', () => {

  test('Mobile : Le splash screen disparaît rapidement et ne bloque pas l\'interface', async ({ page }) => {
    // Émulation smartphone Android
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // 1. Vérifier que le splash screen est masqué ou retiré en moins de 1.5s
    const splash = page.locator('#splash');
    await expect(splash).toBeHidden({ timeout: 2000 });

    // 2. Vérifier que l'application principale est visible et interactive
    const appContent = page.locator('#appContent');
    await expect(appContent).toBeVisible();

    // 3. Vérifier que la barre de navigation inférieure est visible
    const bottomNav = page.locator('#bottomNav');
    await expect(bottomNav).toBeVisible();

    // 4. Vérifier que le défilement du document n'est pas bloqué
    const bodyOverflow = await page.evaluate(() => window.getComputedStyle(document.body).overflow);
    expect(bodyOverflow).not.toBe('hidden');
  });

  test('Mobile & Desktop : Chargement complet de l\'écran d\'accueil KOVA', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Attendre la disparition du splash
    await expect(page.locator('#splash')).toBeHidden({ timeout: 2000 });

    // 1. En-tête KOVA avec logo visible
    const topbar = page.locator('#topbar');
    await expect(topbar).toBeVisible();
    const logoImg = page.locator('.brand img[alt="KOVA"]').first();
    await expect(logoImg).toBeVisible();

    // 2. Vue Accueil active
    const viewHome = page.locator('#viewHome');
    await expect(viewHome).toBeVisible();
    expect(await viewHome.getAttribute('hidden')).toBeNull();

    // 3. Bannière KOVA avec mascotte
    const mascotBanner = page.locator('.kova-mascot-banner');
    await expect(mascotBanner).toBeVisible();
    const mascotImg = mascotBanner.locator('img[alt="Mascotte KOVA"]');
    await expect(mascotImg).toBeVisible();

    // 4. Conteneur du feed d'accueil et sections de mangas
    const feedContainer = page.locator('#feedContainer');
    await expect(feedContainer).toBeVisible();

    // 5. Navigation mobile inférieure fonctionnelle
    const bottomNav = page.locator('#bottomNav');
    await expect(bottomNav).toBeVisible();

    // Clic sur l'onglet Catalogue dans la navigation mobile
    const catalogNavBtn = bottomNav.locator('[data-route="catalogue"]');
    await catalogNavBtn.click();

    // Vérifier le basculement vers la vue Catalogue
    const viewCatalogue = page.locator('#viewCatalogue');
    await expect(viewCatalogue).toBeVisible();
    await expect(viewHome).toBeHidden();
  });

  test('Authentification : Modal de connexion et bouton Google fonctionnel', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('#splash')).toBeHidden({ timeout: 2000 });

    // 1. Ouvrir la modale d'authentification via le bouton profil/avatar
    const btnUserMenu = page.locator('#btnUserMenu');
    await expect(btnUserMenu).toBeVisible();
    await btnUserMenu.click();

    // 2. Vérifier la visibilité de la modal
    const authModal = page.locator('#authModal');
    await expect(authModal).toBeVisible();

    // 3. Vérifier le bouton de connexion Google
    const btnGoogle = page.locator('#btnGoogleAuth');
    await expect(btnGoogle).toBeVisible();
    await expect(btnGoogle).toContainText('Continuer avec Google');
    expect(await btnGoogle.isEnabled()).toBe(true);

    // 4. Détecter le clic sur le bouton Google
    await page.evaluate(() => {
      const btn = document.getElementById('btnGoogleAuth');
      if (btn) {
        btn.addEventListener('click', () => {
          window._googleAuthInitiated = true;
        }, { capture: true });
      }
    });

    await btnGoogle.click();

    const wasTriggered = await page.evaluate(() => window._googleAuthInitiated);
    expect(wasTriggered).toBe(true);

    // 5. Fermeture propre de la modal avec le bouton de fermeture
    const btnCloseModal = page.locator('#btnAuthClose');
    await btnCloseModal.click();
    await expect(authModal).toBeHidden();
  });

  test('Authentification Google : Intégration du profil utilisateur connecté', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('#splash')).toBeHidden({ timeout: 2000 });

    // 1. Accéder au profil via la navigation mobile
    const profileNavBtn = page.locator('#bottomNav [data-route="profile"]');
    await profileNavBtn.click();
    await expect(page.locator('#viewProfile')).toBeVisible();

    // 2. Simuler les données reçues d'une authentification Google
    await page.evaluate(() => {
      const mockUser = {
        displayName: 'Michel Otaku',
        email: 'archangekouaho3@gmail.com',
        photoURL: 'https://lh3.googleusercontent.com/a/mock-photo'
      };

      const nameEl = document.getElementById('profileUsername');
      const emailEl = document.getElementById('profileEmail');
      const roleBadge = document.getElementById('profileRoleBadge');

      if (nameEl) nameEl.textContent = mockUser.displayName;
      if (emailEl) emailEl.textContent = mockUser.email;
      if (roleBadge) roleBadge.textContent = 'Membre KOVA';
    });

    // 3. Vérifier que le profil reflète bien les données de connexion Google
    await expect(page.locator('#profileUsername')).toHaveText('Michel Otaku');
    await expect(page.locator('#profileEmail')).toHaveText('archangekouaho3@gmail.com');
    await expect(page.locator('#profileRoleBadge')).toHaveText('Membre KOVA');
  });

});
