import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import db from "../database.js";
import joi from "joi";
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const categorieSchema = joi.object({
    name: joi.string().required()
});

const gameSchema = joi.object({
    name: joi.string().required(),
    image: joi.string().regex(/(https:\/\/)([^\s(["<,>/]*)(\/)[^\s[",><]*(.png|.jpg)(\?[^\s[",><]*)?/),
    stockTotal: joi.number().integer().min(1),
    categoryId: joi.number().integer().min(1),
    pricePerDay: joi.number().integer()
})

app.get("/categories", async (req,res)=>{
    try{
        const categories = await db.query("SELECT * FROM categories");
        res.status(200).send(categories.rows);
    } catch (e) {
        console.log("Erro ao fazer a operação de receber categorias ", e);
    }
});

app.post("/categories", async (req, res)=>{
    const {name} = req.body;
    const {error} = categorieSchema.validate(req.body);
    if (error) {
        console.log(error.details);
        return res.sendStatus(400);
    }
    const categorias = await db.query(`SELECT * FROM categories WHERE name = ($1)`,[name])
    console.log(categorias);
    if (categorias.rows[0]){
        return res.status(409).send("Nome da categoria já existe");
    }
    try {
        await db.query(`INSERT INTO categories (name) VALUES ($1)`, [name]);
        return res.sendStatus(201);
    } catch (e) {
        console.log("erro ao cadastrar categoria no banco de dados.", e);
        return res.sendStatus(500);
    }
});

app.get("/games", async (req, res)=>{
    try{
        const games = await db.query("SELECT * FROM games");
        res.status(200).send(games.rows);
    } catch (e) {
        console.log("Erro ao fazer a operação para receber os jogos", e);
    }
});

app.get("/games/:name", async (req, res)=>{
    const {name} = req.params;
    try{
        const games = await db.query(`
        SELECT * FROM games 
        WHERE name LIKE $1
        `,[name + '%']);
        return res.status(200).send(games.rows);
    } catch (e) {
        console.log("Erro ao fazer a operação para receber os jogos", e);
        return res.sendStatus(500);
    }
});

app.post("/games", async(req, res)=>{
    const games = req.body;
    const {error} = gameSchema.validate(games);
    if (error){
        console.log(error.details);
        return res.status(400).send("Erro no formato do cadastro de jogo.");
    }

    try{
        const gameExist = await db.query(`
        SELECT * FROM games WHERE "name" = $1
        `, [games.name]);

        if (gameExist.rows.length !== 0) {
            return res.status(409).send('Jogo cadastrado já existe no sistema');
        }

        const categorieExist = await db.query(`
        SELECT * FROM categories WHERE "id" = $1
        `, [games.categoryId]);

        if (categorieExist.rows.length !== 1) {
            return res.status(400).send('Categoria não existe no sistema');
        }

         await db.query(`
         INSERT INTO games ("name", "image", "stockTotal", "categoryId", "pricePerDay") 
         VALUES ($1, $2, $3, $4, $5);
         `, [games.name, games.image, games.stockTotal, games.categoryId, games.pricePerDay]);
         return res.sendStatus(201);
    } catch (e) {
        console.log(e);
        return res.status(500).send('Erro ao cadastrar o jogo no banco de dados');
    }
});

app.listen(process.env.PORT);