'use strict';

// The 3rd target site (Decision D1): a real, live static site with pagination — not a toy
// fixture like the *.toscrape.com sandboxes. scrapethissite.com is a public site explicitly
// intended for scraping practice, so it is an ethical choice for the demo (see the compliance
// note in the report). Its /pages/ section is server-rendered HTML with linked detail pages.
module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    await queryInterface.bulkInsert('sites', [
      {
        name: 'Scrape This Site (real static)',
        base_url: 'https://www.scrapethissite.com/pages/',
        robots_txt: null,
        crawl_delay_ms: 1000,
        allowed: true,
        render_mode: 'static',
        max_depth: 2,
        max_pages: 30,
        created_at: now,
        updated_at: now,
      },
    ]);
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('sites', {
      base_url: ['https://www.scrapethissite.com/pages/'],
    });
  },
};
