import dotenv from "dotenv";
import express from "express";
import cors from "cors";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

app.get("/teste", (req,res)=>{

    res.send("teste!");
})

app.listen(4000);