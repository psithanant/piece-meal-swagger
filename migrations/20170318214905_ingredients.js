exports.up = function(knex, Promise) {
    return knex.schema.createTable('ingredients', (table) => {
        table.increments('id').primary();
        table.string('name').notNullable().defaultTo('');
        table.string('description').defaultTo('');
        table.string('image_url').defaultTo('');
        table.boolean('active').notNullable().defaultTo(true);
        table.timestamp('created_at').notNullable().defaultTo(knex.raw('now()'));
        table.timestamp('updated_at').notNullable().defaultTo(knex.raw('now()'));
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTableIfExists("ingredients");
};
