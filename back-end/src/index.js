import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import dayjs from "dayjs";
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
    categoryId: joi.number().integer(),
    pricePerDay: joi.number().integer().min(1)
})

const customerSchema = joi.object({
    name: joi.string().required(),
    phone: joi.string().min(10).max(11).required(),
    cpf: joi.string().regex(/[0-9]{11}/).length(11).required(),
    birthday: joi.date().required()
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
    const {name} = req.query;
    if (name){
        try{
            const games = await db.query(`
            SELECT games.*, categories."name" as "categoryName" 
            FROM games 
            JOIN categories ON games."categoryId" = categories."id"
            WHERE UPPER(games."name") LIKE UPPER($1)
            `,[name + '%']);
            return res.status(200).send(games.rows);
        } catch (e) {
            console.log("Erro ao fazer a operação para receber os jogos", e);
            return res.sendStatus(500);
        }
    }

    try{
        const games = await db.query(`
        SELECT games.*, categories."name" as "categoryName" 
        FROM games 
        JOIN categories ON games."categoryId" = categories."id";
        `);
        res.status(200).send(games.rows);
    } catch (e) {
        console.log("Erro ao fazer a operação para receber os jogos", e);
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

app.get("/customers", async(req, res)=>{
    const {cpf} = req.query;
    if(cpf){
        try{
            const customers = await db.query(`
            SELECT * FROM customers     
            WHERE "cpf" LIKE $1;
            `, [cpf + '%']);
            return  res.send(customers.rows);
        } catch (e) {
            return res.status(500).send('Erro ao se comunicar com o banco de dados para pegar os clientes ', e);
        }
    }
    try{
        const customers = await db.query(`
        SELECT * FROM customers;
        `);
        return  res.send(customers.rows);
    } catch (e) {
        return res.status(500).send('Erro ao se comunicar com o banco de dados para pegar os clientes ', e);
    }

});

app.get("/customers/:id", async(req, res)=>{
    const {id} = req.params;
    if (id) {
        try{
            const user = await db.query(`
            SELECT * FROM customers WHERE id = $1;
            `, [id]);
            if (user.rows[0].length !== 0){
                return res.send(user.rows[0]);
            }
            return res.sendStatus(404);
        } catch (e){
            return res.status(500).send('Erro ao tentar pegar o usuário no banco de dados.', e)
        }
    } else {
        return res.status(404).status('ID nulo')
    }
});

app.post("/customers", async(req, res)=>{
    const customer = req.body;
    const {error} = customerSchema.validate(req.body);

    if (error){
        console.log(error.details);
        return res.sendStatus(400);
    }

    try{
        const customerExist = await db.query(`
            SELECT * FROM customers 
            WHERE "cpf" = $1;
        `,[customer.cpf]);

        if (customerExist.rows.length !== 0){
            return res.sendStatus(409);
        }

        await db.query(`
        INSERT INTO customers ("name", "phone", "cpf", "birthday") 
        VALUES ($1, $2, $3, $4);
        `, [customer.name, customer.phone, customer.cpf, customer.birthday]);
        return res.sendStatus(201);
    } catch (e){
        console.log(e);
        return res.status(500).send('Não foi possível cadastrar cliente no banco de dados')
    }
});

app.put("/customers/:id", async (req, res)=>{
    const {id} = req.params;
    const customer = req.body;

    if (!id || !customer) {
        return res.sendStatus(404);
    }

    const {error} = customerSchema.validate(req.body);
    if (error){
        return res.status(400).send(error.details);
    }
    try {
        await db.query(`
        UPDATE customers SET 
        "name" = $1, "phone" = $2, "cpf" = $3, "birthday" = $4
        WHERE id = $5;
        `, [customer.name, customer.phone, customer.cpf, customer.birthday, id]);

        return res.sendStatus(200);
    } catch (e) {
        console.log(e);
        return res.send('Erro ao comunicar com o banco para atualizar registro de usuário')
    }

});

app.get("/rentals", async (req, res)=>{
    const arrObj = [];

    try{
        const rentals = await db.query(`
        SELECT rentals.*, customers.name as "customersName" , games.*  
        FROM rentals
        JOIN customers ON rentals."customerId" = customers."id"
         JOIN games ON rentals."gameId" = games."id"
        `)

        rentals.rows.forEach(el=>{
            const obj = {
                id: el.id,
                customerId: el.customerId,
                gameId: el.gameId,
                rentDate: el.rentDate,
                daysRented: el.daysRented,
                returnDate: el.returnDate, // troca pra uma data quando já devolvido
                originalPrice: el.originalPrice,
                delayFee: el.delayFee,
                customer: {
                 id: el.customerId,
                 name: el.customersName
                },
                game: {
                  id: el.gameId,
                  name: el.name,
                  categoryId: el.categoryId,
                  categoryName: el.cate
                }
              }
              arrObj.push(obj);
        })
        


        return res.send(arrObj);
    } catch (e) {
        return res.status(500).send('Erro ao se comunicar com o banco de dados para pegar os alugueis ', e);
    }
});

app.post("/rentals", async (req, res)=>{
    const rental = req.body;
    const today = dayjs().format('YYYY-MM-DD');

    try{
        const game = await db.query(`
        SELECT * FROM games
        WHERE id = $1;
        `,[rental.gameId]);

        const customers = await db.query(`
        SELECT * FROM customers
        WHERE id = $1;
        `,[rental.customerId]);

        if (game.rows.length === 0 || rental.daysRented === 0 || customers.rows.length === 0){
            return res.sendStatus(400);
        }

        const price = game.rows[0].pricePerDay;

        await db.query(`
        INSERT INTO rentals ("customerId", "gameId", "rentDate", "daysRented", "originalPrice") VALUES ($1, $2, $3, $4, $5);
        `,[rental.customerId, rental.gameId, today, rental.daysRented, (parseInt(price) * parseInt(rental.daysRented))])
        return res.sendStatus(201);
    } catch (e){
        console.log(e);
        return res.status(500).send(e);
    }
});

app.post("/rentals/:id/return", async (req, res)=>{
    const {id} = req.params;
    const today = new Date(dayjs().format('YYYY-MM-DD'));

    try{
        let delay = 0;
        const rental = await db.query(`
        SELECT * FROM rentals
        WHERE id = $1;
        `,[id]);
        
        if (rental.rows.length === 0){
            return res.sendStatus(404);
        }
        
        let daysRented = new Date(rental.rows[0].rentDate);
        daysRented.setDate(daysRented.getDate() + rental.rows[0].daysRented);
        const lateDays = Math.round((today - new Date(daysRented)) / 86400000);
        if (lateDays){
            delay = lateDays * rental.rows[0].originalPrice;
        }

        await db.query(`
        UPDATE rentals SET "returnDate" = $1, "delayFee" = $2 WHERE "id" = $3
        `,[today, delay, id]);

        return res.sendStatus(200);
    } catch (e){
        console.log(e);
        return res.sendStatus(500);
    }
});

app.delete("/rentals/:id", async (req, res)=>{
    const {id} = req.params;
    try{
        const rental = await db.query(`
        SELECT * FROM rentals
        WHERE "id" = $1
        `,[id]);
        console.log(rental.rows[0])
        console.log(rental.rows.length)

        if (rental.rows.length === 0){
            return res.sendStatus(404);
        }
        if (!rental.rows[0].returnDate){
            return res.sendStatus(400);
        }

        await db.query(`
        DELETE FROM rentals 
        WHERE "id" = $1
        `, [id]);
        return res.sendStatus(200);
    } catch (e) {
        console.log(e);
        res.sendStatus(500);
    }
});

app.listen(process.env.PORT);