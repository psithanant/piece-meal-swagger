'use strict';
const knex = require('../../knex');
const bookshelf = require('../../bookshelf');
const bcrypt = require('bcrypt-as-promised');
const jwt = require('jsonwebtoken');
const Recipe = require('../models/recipe.js').Recipe;
const Recipes = require('../models/recipe.js').Recipes;
const RecipeStep = require('../models/recipe.js').RecipeStep;
const RecipeSteps = require('../models/recipe.js').RecipeSteps;

module.exports = {
    getRecipesList: getRecipesList,
    getClientRecipes: getClientRecipes,
    addClientRecipe: addClientRecipe,
    getRecipe: getRecipe,
    postRecipe: postRecipe,
    updateRecipe: updateRecipe,
    deleteRecipe: deleteRecipe,
    searchRecipes: searchRecipes,
    rateRecipe: rateRecipe
    // getRecipeBookshelf: getRecipeBookshelf
};

function doGetRecipes(query, res) {
    let recipes;
    let ingredients;
    query.then((rows) => {
        recipes = rows;
        let promises = rows.map((recipe) => getIngredientsQuery(recipe.id));
        return Promise.all(promises);
    }).then((promiseResults) => {
        // 'recipes' is an array of the recipes
        // 'promiseResults' is an array of arrays of ingredients
        for (var i = 0; i < recipes.length; i++) {
            recipes[i].ingredients = promiseResults[i].map((ingredient) => {
                delete ingredient.created_at;
                delete ingredient.updated_at;
                return ingredient;
            });
        }
        return;
    }).then(() => {
    //   let promises = [];
    //
    //   for(let i = 0; i < recipes.length; i++){
    //     for (let j = 0; j < recipes[i].ingredients.length; j++) {
    //       let x = recipes[i].ingredients.map(
    //         (ingredient) => {
    //           console.log(ingredient.id);
    //           getIngredientTagsQuery(ingredient.id)
    //         }
    //       );
    //       promises.push(
    //         Promise.all(x)
    //       );
    //     }
    //   }
    //   return Promise.all(promises);
    // }).then((promiseResults) => {
    //   // for(let [idx, promise] of promiseResults.entries()) {
    //   //   console.log(idx, promise);
    //   // }
    //   for (var i = 0; i < recipes.length; i++) {
    //     for(let j = 0; j < recipes[i].ingredients.length; j++) {
    //       recipes[i].ingredients[j].tags = promiseResults[i][j].map((tag) => {
    //           return tag.tag_text;
    //       });
    //     }
    //   }
    // }).then(() => {
        let promises = recipes.map((recipe) => getRecipeStepsQuery(recipe.id));

        return Promise.all(promises);
    }).then((promiseResults) => {
        for (var i = 0; i < recipes.length; i++) {
            recipes[i].instructions = promiseResults[i];
        }

        return res.json({recipes: recipes});
    });
}

// /recipes
function getRecipesList(req, res) {
    return doGetRecipes(knex("recipes"), res);
}

function getClientRecipes(req, res) {
    const query = knex("recipes").join('client_recipes', 'client_recipes.recipe_id', 'recipes.id').select("recipes.*").where('client_recipes.client_id', req.swagger.params.user_id.value);
    return doGetRecipes(query, res);
}

function addClientRecipe(req, res) {
    jwt.verify(req.headers['token'], process.env.JWT_KEY, (err, payload) => {
        if (err) {
            res.set('Content-Type', 'application/json');
            res.status(401).send('Unauthorized');
        }

        return knex("client_recipes").insert({client_id: req.swagger.params.user_id.value, recipe_id: req.swagger.params.request.value.recipe_id}).then(() => {
            res.json({success: 1, description: "Added"});
        });
  });
}

function getIngredientsQuery(recipeId) {
    return knex("recipe_ingredients").join("ingredients", "ingredients.id", "recipe_ingredients.ingredient_id").select("ingredients.id", "ingredients.name", "ingredients.description", "ingredients.active", "ingredients.image_url").orderBy('id').where("recipe_ingredients.recipe_id", recipeId);
}

function getIngredientTagsQuery(ingredientId) {
    return knex("ingredient_tags").where("ingredient_tags.ingredient_id", ingredientId).orderBy('tag_text');
}

function getRecipeStepsQuery(recipeId) {
    return knex("recipe_steps").join("recipes", "recipes.id", "recipe_steps.recipe_id").select("recipe_steps.step_number", "recipe_steps.instructions").orderBy('step_number').where("recipe_steps.recipe_id", recipeId);
}

function getRecipeTagsQuery(recipeId) {
    return knex("recipe_tags").join("recipes", "recipes.id", "recipe_tags.recipe_id").select("recipe_tags.tag_text").orderBy('tag_text').where("recipe_tags.recipe_id", recipeId);
}

function getRecipe(req, res) {
    return doGetRecipe(req.swagger.params.id.value, res);
}

function doGetRecipe(recipeId, res) {
    let recipe;
    let promises = [];
    promises.push(knex("recipes").select("id", "name", "description", "notes", "image_url", "active").first().where("id", recipeId));
    promises.push(getIngredientsQuery(recipeId));
    promises.push(getRecipeStepsQuery(recipeId));
    promises.push(getRecipeTagsQuery(recipeId));

    Promise.all(promises).then((results) => {
        recipe = results[0];
        let ingredients = results[1];
        let instructions = results[2];
        let tags = results[3];

        if (!recipe) {
            // res.set('Content-Type', 'application/json');
            // res.sendStatus(404);
            // return;
            res.status(404).json('Not Found');
        }

        recipe.ingredients = ingredients;

        recipe.instructions = instructions;

        recipe.tags = tags.map((tag) => {
            return tag.tag_text;
        })

        let proms = recipe.ingredients.map(ingredient => getIngredientTagsQuery(ingredient.id));

        return Promise.all(proms);
    }).then((result) => {

        for (let i = 0; i < recipe.ingredients.length; i++) {
            recipe.ingredients[i].tags = result[i].map(tag => tag.tag_text);
        }

        return res.json(recipe);
    }).catch((err) => {
        res.status(500).json({message: err});
    });
}

function rateRecipe(req, res) {
  jwt.verify(req.headers['token'], process.env.JWT_KEY, (err, payload) => {
      if (err) {
          res.set('Content-Type', 'application/json');
          res.status(401).send('Unauthorized');
      } else {
        let recipe_id = req.swagger.params.recipe_id.value;
        let vote = req.swagger.params.vote.value.vote;
        let client_id = req.swagger.params.vote.value.client_id;

        knex("recipe_votes").first().where("recipe_id", recipe_id).andWhere("client_id", client_id).then((result) => {
            if (result) {
                return knex("recipe_votes")
                .where("recipe_id", recipe_id).andWhere("client_id", client_id)
                .update({vote: vote});
            } else {
                return knex("recipe_votes")
                .insert({"recipe_id": recipe_id, client_id: client_id, vote: vote});
            }
        })
        .then(() => {
          return doGetRecipe(recipe_id, res);
        });
      }
  });
}

function postRecipe(req, res) {
    jwt.verify(req.headers['token'], process.env.JWT_KEY, (err, payload) => {
        if (err) {
            res.set('Content-Type', 'application/json');
            res.status(401).send('Unauthorized');
        }

        //to insert into recipes table
        let recipe;
        let name = req.swagger.params.recipe.value.name;
        let description = req.swagger.params.recipe.value.description;

        // to insert into the recipe_steps table
        let instructions = req.swagger.params.recipe.value.instructions;

        //to insert into recipe_ingredients table
        let ingredients = req.swagger.params.recipe.value.ingredients;
        let tags = req.swagger.params.recipe.value.tags;
        knex("recipes").first().where("name", name).then((result) => {
            if (result) {
                res.status(400).json("Recipe already exists!");
            } else {
                return knex("recipes").insert({"name": name, description: description}).returning("*");
            }
        }).then((recipes) => { // insert ingredients
            recipe = recipes[0];
            let data = ingredients.map((value) => {
                return {recipe_id: recipe.id, ingredient_id: value};
            });
            return knex('recipe_ingredients').insert(data).returning("*");
        }).then(() => { // insert instructions
            let data = instructions.map((step) => {
                return {recipe_id: recipe.id, step_number: step.step_number, instructions: step.instructions};
            });
            return knex('recipe_steps').insert(data).returning("*");
        }).then(() => { // insert instructions
            let data = tags.map((tag) => {
                return { recipe_id: recipe.id, tag_text: tag };
            });
            return knex('recipe_tags').insert(data).returning("*");
        }).then(() => { // return new recipe
            return doGetRecipe(recipe.id, res);
        });
  });
}

function updateRecipe(req, res) {
    jwt.verify(req.headers['token'], process.env.JWT_KEY, (err, payload) => {
        if (err) {
            res.set('Content-Type', 'application/json');
            res.status(401).send('Unauthorized');
        }

        let id = req.swagger.params.id.value;
        let recipe = req.swagger.params.recipe.value;

        knex('recipes').where('id', id).del().then(() => {
            return knex("recipes").first().where("name", recipe.name);
        }).then((result) => {
            if (result) {
                res.status(400).json("Recipe already exists!");
            } else {
                return knex("recipes").insert({"id": id, "name": recipe.name, description: recipe.description, notes: recipe.notes}).returning("*");
            }
        }).then((recipes) => {
            //to insert into recipe_ingredients table

            let data = recipe.ingredients.map((value) => {
                return {recipe_id: recipe.id, ingredient_id: value};
            });

            return knex('recipe_ingredients').insert(data).returning("*");
        }).then(() => {
            // to insert into the recipe_steps table

            let data = recipe.instructions.map((step) => {
                return {recipe_id: recipe.id, step_number: step.step_number, instructions: step.instructions};
            });

            return knex('recipe_steps').insert(data).returning("*");
        }).then(() => {
            // to insert into the recipe_steps table

            let data = recipe.tags.map((tag) => {
                return {recipe_id: recipe.id, tag_text: tag};
            });

            return knex('recipe_tags').insert(data).returning("*");
        }).then(() => { // return updated recipe
            return doGetRecipe(recipe.id, res);
        }).catch((err) => {
            console.log(err);
        });
  });
}

function deleteRecipe(req, res) {
    jwt.verify(req.headers['token'], process.env.JWT_KEY, (err, payload) => {
        if (err) {
            res.set('Content-Type', 'application/json');
            res.status(401).send('Unauthorized');
        }

        let id = Number(req.swagger.params.id.value);
        // return knex('recipes').where('id', id).then((result) => {
        //     let recipe = result[0];
        //     delete recipe.id;
        //     res.json(recipe);
        // }).then(() => {
        //     knex('recipes').where('id', id).del();
        // });
        knex('recipes').where('id', id).update({active: false}).then(() => {
            return knex('recipes').select('id', 'name', 'active').first().where('id', id);
        }).then((recipe) => {
            return res.json(recipe)
        });
  });
}

function searchRecipes(req, res) {
    // To list clients
    // let text = req.swagger.params.text.value;
    return doGetRecipes(knex("recipes")
    .join('recipe_ingredients', 'recipes.id', 'recipe_ingredients.recipe_id')
    .leftJoin('ingredient_tags', 'recipe_ingredients.ingredient_id', 'ingredient_tags.ingredient_id')
    .leftJoin('ingredients', 'recipe_ingredients.ingredient_id', 'ingredients.id')
    .distinct('recipes.*')
    .where('recipes.name', 'ilike', `%${req.swagger.params.text.value}%`)
    .orWhere('recipes.description', 'ilike', `%${req.swagger.params.text.value}%`)
    .orWhere('ingredients.name', 'ilike', `%${req.swagger.params.text.value}%`)
    .orWhere('ingredient_tags.tag_text', 'ilike', `%${req.swagger.params.text.value}%`)
    .orderBy('recipes.name'), res);
}

// function getRecipeBookshelf(req, res) {
//   Recipe.forge({
//           id: req.swagger.params.id.value
//       })
//       .fetch({
//           // withRelated: ['steps', 'tags', 'ingredients']
//           withRelated: ['instructions', 'tags']
//       })
//       .then((recipe) => {
//           let recipeObj = recipe.serialize();
//           recipeObj.tags = recipeObj.instructions.map((value) => {
//               return value.instructions;
//           }).sort();
//
//           delete recipeObj.created_at;
//           delete recipeObj.updated_at;
//
//           return res.json(recipeObj);
//       }).catch((err) => {
//           res.status(500).json({message: err});
//       });
// }
