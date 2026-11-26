/**
 * Migration 10: blog article banner and thumbnail.
 * - blog_articles.banner_image    16:9 picture at the top of the article and in the sliding banner on blog.htm
 * - blog_articles.thumbnail_image 16:9 picture on the article card in the blog list (falls back to the banner)
 * - blog_articles.show_in_banner  include the article in the sliding banner (default yes)
 * The existing cover_image (picture inside the article) is kept as it is.
 * Idempotent: safe on fresh and existing databases.
 */
module.exports = {
  name: '20261121000010-blog-banner-and-thumbnail.js',

  async up({ sequelize }) {
    console.log('Running migration: 20261121000010-blog-banner-and-thumbnail.js...');
    async function addColumnIfNotExists(table, column, definition) {
      const [cols] = await sequelize.query(`SHOW COLUMNS FROM \`${table}\` LIKE '${column}';`);
      if (cols.length === 0) {
        await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition};`);
        console.log(`  + Added column \`${table}\`.\`${column}\``);
      }
    }
    await addColumnIfNotExists('blog_articles', 'banner_image', 'VARCHAR(255) NULL');
    await addColumnIfNotExists('blog_articles', 'thumbnail_image', 'VARCHAR(255) NULL');
    await addColumnIfNotExists('blog_articles', 'show_in_banner', 'TINYINT(1) NOT NULL DEFAULT 1');
    console.log('Migration 10 completed successfully.');
  },

  async down() {
    console.log('Migration 10 has no automatic rollback (additive).');
  }
};
