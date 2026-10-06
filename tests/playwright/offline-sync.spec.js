// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Gestion hors-ligne, file d\'attente et synchronisation réseau', () => {

  test('Simule une coupure réseau, enregistre les actions dans la file et synchronise à la reconnexion', async ({ page, context }) => {
    await page.goto('/');

    // 1. Vérifier que l'application démarre normalement en ligne
    const offlineBanner = page.locator('#offlineBanner');
    await expect(offlineBanner).toBeHidden();

    // 2. Couper le réseau (Offline simulation)
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));

    // Vérifier l'apparition de la bannière hors-ligne
    await expect(offlineBanner).toBeVisible();
    await expect(page.locator('#offlineBannerText')).toContainText('Mode hors-ligne');

    // 3. Effectuer une action hors-ligne (ex: ajout d'un favori ou modification de progression)
    await page.evaluate(() => {
      // Simule un appel de mise en file d'attente hors-ligne avec horodatage
      window.queueOfflineAction({
        type: 'favorites',
        id: 'anime_12345',
        value: {
          id: 'anime_12345',
          title: 'Demon Slayer',
          addedAt: Date.now()
        }
      });
    });

    // 4. Vérifier que la file d'attente otaku_offline_queue contient bien l'opération avec un horodatage
    const queueData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('otaku_offline_queue') || '[]');
    });

    expect(queueData.length).toBe(1);
    expect(queueData[0].id).toBe('anime_12345');
    expect(queueData[0].timestamp).toBeGreaterThan(0);

    // 5. Rétablir la connexion réseau (Online simulation)
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    // 6. Déclencher et vérifier la synchronisation
    await page.evaluate(async () => {
      await window.syncOfflineQueue();
    });

    // 7. Confirmer que la file d'attente principale a été vidée après synchronisation
    const queueAfterSync = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('otaku_offline_queue') || '[]');
    });

    expect(queueAfterSync.length).toBe(0);
  });

  test('Résolution de conflit (LWW) : préserve la version la plus récente', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      // Nettoyage préalable
      localStorage.removeItem('otaku_offline_queue');

      const olderTime = Date.now() - 60000;
      const newerTime = Date.now();

      // Première action (ancienne)
      window.queueOfflineAction({
        type: 'progress',
        id: 'anime_555',
        value: { episode: 3, timestamp: olderTime }
      });

      // Deuxième action sur le même item (plus récente)
      window.queueOfflineAction({
        type: 'progress',
        id: 'anime_555',
        value: { episode: 4, timestamp: newerTime }
      });

      const queue = JSON.parse(localStorage.getItem('otaku_offline_queue') || '[]');
      return {
        count: queue.length,
        episode: queue[0]?.value?.episode
      };
    });

    // La file d'attente doit avoir dédoublonné et conservé uniquement l'épisode 4 le plus récent
    expect(result.count).toBe(1);
    expect(result.episode).toBe(4);
  });

  test('Repli in-app pour les rappels lorsque les notifications système sont désactivées', async ({ page }) => {
    await page.goto('/');

    // Simuler le déclenchement d'un rappel simulcast sans permission système
    await page.evaluate(() => {
      window.showInAppReminderAlert('Jujutsu Kaisen', 'L\'épisode 10 vient de sortir en simulcast !');
    });

    const alertBanner = page.locator('#inAppReminderAlert');
    await expect(alertBanner).toBeVisible();
    await expect(page.locator('#inAppReminderTitle')).toHaveText('Jujutsu Kaisen');
    await expect(page.locator('#inAppReminderDesc')).toContainText('Épisode 10');

    // Fermeture de l'alerte
    await page.locator('#btnCloseInAppAlert').click();
    await expect(alertBanner).toBeHidden();
  });
});
