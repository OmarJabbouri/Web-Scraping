'use strict';

// The 3rd target site (real-world static blog/docs) is picked during Phase 3 — add it with
// a follow-up seeder or `INSERT` once chosen, rather than guessing it here.
module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    await queryInterface.bulkInsert('sites', [
      {
        name: 'Books to Scrape',
        base_url: 'https://books.toscrape.com/',
        robots_txt: null,
        crawl_delay_ms: 500,
        allowed: true,
        render_mode: 'static',
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Quotes to Scrape (JS)',
        base_url: 'https://quotes.toscrape.com/js/',
        robots_txt: null,
        crawl_delay_ms: 500,
        allowed: true,
        render_mode: 'js',
        created_at: now,
        updated_at: now,
      },
    ]);
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('sites', {
      base_url: ['https://books.toscrape.com/', 'https://quotes.toscrape.com/js/'],
    });
  },
};
