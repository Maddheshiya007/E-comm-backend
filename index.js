const port = process.env.PORT || 4000;
const express = require('express');
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const exp = require('constants');
const cloudinary = require('cloudinary').v2;
const fileupload = require('express-fileupload');
require('dotenv').config();
const stripe = require('stripe')("sk_test_51OZdLxSDBAKiS622QsxbhBk2RdDm949ZSMuF4krXRY5l6mJy1ozfaT0WkZJM1oA1bUErbgtl6fIs2P4ebGV1wLNx00uxQgALft")

app.use(fileupload({
    useTempFiles: true
}))
app.use(express.json());
app.use(cors());

cloudinary.config({
    cloud_name: process.env.cloud_name,
    api_key: process.env.api_key,
    api_secret: process.env.api_secret
})

//Database connection with mongodb
mongoose.connect(`${process.env.DATABASE_URL}`)

// Api creation

app.get("/", (req, res) => {
    res.send("Express app is running")
})


//Image Storage Engine

// const storage = multer.diskStorage({
//     filename: (req, file, cb) => {
//         return cb(null, file.originalname)
//     }
// })
// const upload = multer({ storage: storage });

// creating endpoint for stripe payment

app.post('/create-checkout-session', async (req,res)=>{
    const {products} = req.body;

    const lineItems = products.map((product)=>({
        price_data:{
            currency:"inr",
            product_data:{
                name:product.name,
            },
            unit_amount:product.price*100,
        },
        quantity:product.qty
    }))
    const session = await stripe.checkout.sessions.create({

        payment_method_types:['card'],
        line_items:lineItems,
        mode:"payment",
        success_url:"http://localhost:3000",
        cancel_url:"http://localhost:3000"
    })
    res.json({id:session.id})

})

// Creating upload endpoint for images upload.single('product')
app.post("/upload", async (req, res) => {
    try {
        let imz = req.files.product;
        const data = await cloudinary.uploader.upload(imz.tempFilePath)
        console.log(data);
        res.json({
            success: true,
            secure_url: data.secure_url,
            public_id: data.public_id
        })
    }
    catch (error) {
        console.error(error);
    }
})

// Schema for crating products

const Product = mongoose.model("Product", {
    id: {
        type: Number,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    image: {
        type: String,
        required: true,
    },
    image_id: {
        type: String,
    },
    category: {
        type: String,
        required: true,
    },
    new_price: {
        type: Number,
        required: true,
    },
    old_price: {
        type: Number,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    available: {
        type: Boolean,
        default: true,
    },

})

app.post('/addproduct', async (req, res) => {
    let products = await Product.find({});
    let id;
    if (products.length > 0) {
        let last_product_array = products.slice(-1);
        let last_product = last_product_array[0];
        id = last_product.id + 1;
    }
    else {
        id = 1;
    }
    const product = new Product({
        id: id,
        name: req.body.name,
        image: req.body.image,
        image_id: req.body.image_id,
        category: req.body.category,
        new_price: req.body.new_price,
        old_price: req.body.old_price,
    })
    console.log(product);
    await product.save();
    console.log("product saved");
    res.json({
        success: true,
        name: req.body.name,
    })
})

// Creating API for deleting products

app.post('/removeproduct', async (req, res) => {
    const product = await Product.findOne({ id: req.body.id })
    image_id = product.image_id;
    await cloudinary.uploader.destroy(image_id);
    await Product.findOneAndDelete({ id: req.body.id });
    console.log("product removed")
    res.json({
        success: true,
        name: req.body.name,
    })
})


// Creating API for getting all products
app.get('/allproducts', async (req, res) => {
    let products = await Product.find({});
    res.send(products);
})

// Schema creating for user model

const Users = mongoose.model('Users', {
    name: {
        type: String
    },
    email: {
        type: String,
        unique: true,
    },
    password: {
        type: String
    },
    cartData: {
        type: Object
    },
    date: {
        type: Date,
        default: Date.now
    }
})


// Creating endpoint for registering the user
app.post('/signup', async (req, res) => {
    let check = await Users.findOne({ email: req.body.email })
    if (check) {
        return res.status(400).json({ success: false, error: "existing user found with same email id" })
    }
    let cart = {};
    for (let id = 0; id < 300; id++) {
        cart[id] = 0;

    }
    const user = new Users({
        name: req.body.username,
        email: req.body.email,
        password: req.body.password,
        cartData: cart,
    })
    await user.save();
    const data = {
        user: {
            id: user.id
        }
    }

    const token = jwt.sign(data, `${process.env.SECRET_KEY}`);
    res.json({ success: true, token })
})

// creating endpoint for user login

app.post('/login', async (req, res) => {
    let user = await Users.findOne({
        email: req.body.email
    });
    if (user) {
        const passCompare = req.body.password === user.password;
        if (passCompare) {
            const data = {
                user: {
                    id: user.id
                }
            }
            const token = jwt.sign(data, `${process.env.SECRET_KEY}`)
            res.json({ success: true, token })
        }
        else {
            res.json({
                success: false,
                error: "Wrong Password"
            })
        }

    }
    else {
        res.json({
            success: false,
            error: "Wrong Email Id"
        })
    }
})


app.listen(port, (error) => {
    if (!error) {
        console.log("Server Running on Port " + port);
    }
    else {
        console.log("Error: " + error);
    }
})