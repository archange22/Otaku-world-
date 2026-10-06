// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Carrousels, srcset adaptatif et fallback d\'image Otaku-World', () => {

  test('Vérification du srcset et de la résolution d\'affiche sur ordinateur (Desktop)', async ({ page }) => {
    // Écran bureau large
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Attendre le chargement du premier carrousel
    const firstCard = page.locator('.card').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });

    const posterImg = firstCard.locator('.card-poster img');
    await expect(posterImg).toBeVisible();

    // Vérifier la présence de l'attribut srcset et de sizes
    const srcset = await posterImg.getAttribute('srcset');
    const sizes = await posterImg.getAttribute('sizes');

    expect(srcset).toBeTruthy();
    expect(srcset).toContain('230w');
    expect(sizes).toContain('170px');

    // Vérifier les attributs de performance
    expect(await posterImg.getAttribute('loading')).toBe('lazy');
    expect(await posterImg.getAttribute('decoding')).toBe('async');
  });

  test('Vérification du srcset et du comportement tactile sur smartphone (Mobile)', async ({ page }) => {
    // Écran mobile type Android / Pixel / iPhone
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const firstCard = page.locator('.card').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });

    const posterImg = firstCard.locator('.card-poster img');
    const sizes = await posterImg.getAttribute('sizes');
    expect(sizes).toContain('(max-width: 640px) 130px');

    // Vérifier que le défilement tactile horizontal est actif sans scrollbar parasite
    const scrollContainer = page.locator('.feed-scroll').first();
    const overflowX = await scrollContainer.evaluate(el => window.getComputedStyle(el).overflowX);
    expect(overflowX).toBe('auto');
  });

  test('Bascule propre vers le placeholder SVG en cas d\'échec de chargement d\'image', async ({ page }) => {
    await page.goto('/');

    const firstCard = page.locator('.card').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });

    const posterImg = firstCard.locator('.card-poster img');

    // Simuler une défaillance de chargement d'image
    await posterImg.evaluate(img => {
      // Déclenche l'erreur sur l'image
      img.dispatchEvent(new Event('error'));
    });

    // Attendre les tentatives discrètes et la bascule finale vers le placeholder SVG
    await page.waitForTimeout(3000);

    const currentSrc = await posterImg.getAttribute('src');
    expect(currentSrc).toContain('data:image/svg+xml');
    expect(currentSrc).toContain('OTAKU-WORLD');

    // S'assurer de la présence de la classe de fallback
    const hasFallbackClass = await posterImg.evaluate(img => img.classList.contains('poster-fallback'));
    expect(hasFallbackClass).toBe(true);
  });

  test('Navigation au clavier dans le carrousel avec Flèches, Home et End', async ({ page }) => {
    await page.goto('/');

    const scrollContainer = page.locator('.feed-scroll').first();
    await expect(scrollContainer).toBeVisible();

    // Focus sur le carrousel
    await scrollContainer.focus();

    // Pression de la touche Fin pour aller directement à la dernière carte
    await page.keyboard.press('End');
    await page.waitForTimeout(400);

    const scrollLeftAfterEnd = await scrollContainer.evaluate(el => el.scrollLeft);
    expect(scrollLeftAfterEnd).toBeGreaterThan(0);

    // Pression de la touche Début pour revenir au départ
    await page.keyboard.press('Home');
    await page.waitForTimeout(400);

    const scrollLeftAfterHome = await scrollContainer.evaluate(el => el.scrollLeft);
    expect(scrollLeftAfterHome).toBe(0);
  });
});
