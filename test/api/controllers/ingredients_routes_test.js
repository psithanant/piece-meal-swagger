/*jshint esversion: 6 */
'use strict';

process.env.NODE_ENV = 'test';

const should = require('should');
const request = require('supertest');
const server = require('../../../app');
const knex = require('../../../knex');
const {
    suite,
    test
} = require('mocha');

console.log(suite);

suite('ingredients test', () => {
    before((done) => {
        knex.migrate.latest()
            .then(() => {
                done();
            })
            .catch((err) => {
                done(err);
            });
    });

    beforeEach((done) => {
        knex.seed.run()
            .then(() => {
                done();
            })
            .catch((err) => {
                done(err);
            });
    });

    test('GET /ingredients', (done) => {
        /* eslint-disable max-len */
        request(server)
            .get('/ingredients')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200, {
                "ingredients": [{
                        "id": 1,
                        "name": "bacon",
                        "tags": [],
                        "active": true
                    },
                    {
                        "id": 2,
                        "name": "egg",
                        "tags": [],
                        "active": true
                    },
                    {
                        "id": 3,
                        "name": "milk",
                        "tags": [],
                        "active": true
                    },
                    {
                        "id": 4,
                        "name": "avocado",
                        "tags": [],
                        "active": true
                    }
                ]
            }, done);
    });

    test('GET /ingredients/:id', (done) => {
        /* eslint-disable max-len */
        request(server)
            .get('/ingredients/1')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200, {
                "id": 1,
                "name": "bacon",
                "tags": [],
                "active": true
            }, done);

        /* eslint-enable max-len */
    });

    test('POST /ingredients', (done) => {
        /* eslint-disable max-len */
        request(server)
            .post('/ingredients')
            .set('Accept', 'application/json')
            .send({
                name: 'salmon',
                tags: ['seafood', 'fish'],
                active: true
            })
            .expect('Content-Type', /json/)
            .expect((res) => {
                delete res.body.createdAt;
                delete res.body.updatedAt;
            })
            .expect(200, {
                id: 5,
                name: 'salmon',
                tags: ['seafood', 'fish'],
                active: true
            }, done);

        /* eslint-enable max-len */
    });

    test('PATCH /ingredients/:id', (done) => {
        /* eslint-disable max-len */
        request(server)
            .patch('/ingredients/1')
            .set('Accept', 'application/json')
            .send({
                name: 'BACON',
                tags: ['pork'],
                active: true
            })
            .expect('Content-Type', /json/)
            .expect((res) => {
                delete res.body.createdAt;
                delete res.body.updatedAt;
            })
            .expect(200, {
                id: 1,
                name: 'BACON',
                tags: ['pork'],
                active: true
            }, done);

        /* eslint-enable max-len */
    });

    test('DELETE /ingredients/:id', (done) => {
        /* eslint-disable max-len */
        request(server)
            .del('/ingredients/1')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect((res) => {
                delete res.body.createdAt;
                delete res.body.updatedAt;
            })
            .expect(200, {
                name: 'salmon',
                tags: ['seafood', 'fish'],
                active: false
            }, done);

        /* eslint-enable max-len */
    });
});