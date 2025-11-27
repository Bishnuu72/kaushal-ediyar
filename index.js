require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const app = express();

// === FIX: Prevent model overwrite on Vercel ===
let Owner, Product;

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB Connected');

  // Define models only if not already defined
  if (!mongoose.models.Owner) {
    const ownerSchema = new mongoose.Schema({
      name: String,
      email: String,
      phone: String,
      address: String,
      photo: { type: String, default: "https://i.ibb.co/0jY7Z7K/kaushal-photo.jpg" },
      heroBg: { type: String, default: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1950&q=80" }
    });
    Owner = mongoose.model('Owner', ownerSchema);
  } else {
    Owner = mongoose.model('Owner');
  }

  if (!mongoose.models.Product) {
    const productSchema = new mongoose.Schema({
      name: String,
      price: Number,
      description: String,
      image: String
    });
    Product = mongoose.model('Product', productSchema);
  } else {
    Product = mongoose.model('Product');
  }

  // Create default owner if not exists
  const owner = await Owner.findOne();
  if (!owner) {
    await new Owner({
      name: "Kaushal Ediyar",
      email: "kaushal.ediyar@gmail.com",
      phone: "+91 98765 43210",
      address: "Surat, Gujarat, India"
    }).save();
  }
}

connectDB();

// Middleware
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false
}));

const upload = multer({ dest: 'uploads/' });

// Auth
const isAuth = (req, res, next) => {
  if (req.session.isAuth) return next();
  res.redirect('/login');
};

// Routes
app.get('/', async (req, res) => {
  const [products, owner] = await Promise.all([Product.find(), Owner.findOne()]);
  res.render('public', { products, owner: owner || {} });
});

app.get('/login', (req, res) => res.render('login', { error: null }));

app.post('/login', (req, res) => {
  if (req.body.username === "Kaushal" && req.body.password === "kaushal123") {
    req.session.isAuth = true;
    return res.redirect('/admin');
  }
  res.render('login', { error: "Wrong credentials" });
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

app.get('/admin', isAuth, async (req, res) => {
  const [products, owner] = await Promise.all([Product.find(), Owner.findOne()]);
  res.render('admin', { products, owner: owner || {} });
});

app.post('/admin/add', isAuth, upload.single('image'), async (req, res) => {
  await new Product({
    name: req.body.name,
    price: req.body.price,
    description: req.body.description,
    image: '/uploads/' + req.file.filename
  }).save();
  res.redirect('/admin');
});

app.post('/admin/update/:id', isAuth, upload.single('image'), async (req, res) => {
  const update = { name: req.body.name, price: req.body.price, description: req.body.description };
  if (req.file) update.image = '/uploads/' + req.file.filename;
  await Product.findByIdAndUpdate(req.params.id, update);
  res.redirect('/admin');
});

app.post('/admin/delete/:id', isAuth, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.redirect('/admin');
});

app.post('/admin/update-profile', isAuth, upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'heroBg', maxCount: 1 }
]), async (req, res) => {
  const update = {
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    address: req.body.address
  };
  if (req.files.photo) update.photo = '/uploads/' + req.files.photo[0].filename;
  if (req.files.heroBg) update.heroBg = '/uploads/' + req.files.heroBg[0].filename;
  await Owner.findOneAndUpdate({}, update, { upsert: true });
  res.redirect('/admin');
});

// Vercel handler
module.exports = app;