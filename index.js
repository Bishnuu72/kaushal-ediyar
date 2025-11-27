require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcrypt');
const path = require('path');
const app = express();

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB Atlas Connected'))
  .catch(err => console.log(err));

// Product Schema
const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  description: String,
  image: String
});
const Product = mongoose.model('Product', productSchema);

// Middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

// Multer for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Auth Middleware
const isAuth = (req, res, next) => {
  if (req.session.isAuth) next();
  else res.redirect('/login');
};

// Routes

// 1. Login Page
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && 
      await bcrypt.compare(password, await bcrypt.hash(process.env.ADMIN_PASSWORD, 10))) {
    req.session.isAuth = true;
    return res.redirect('/admin');
  }
  res.render('login', { error: 'Invalid credentials' });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// 2. Public View Page (Anyone can see)
app.get('/', async (req, res) => {
  const products = await Product.find();
  res.render('public', { products });
});

// 3. Admin Dashboard (Full CRUD - Protected)
app.get('/admin', isAuth, async (req, res) => {
  const products = await Product.find();
  res.render('admin', { 
    products, 
    adminName: "Kaushal Ediyar",
    email: "kaushalediyar@gmail.com",
    phone: "9825388045",
    address: "Itahari, Nepal"
  });
});

// Add Product
app.post('/admin/add', isAuth, upload.single('image'), async (req, res) => {
  const { name, price, description } = req.body;
  const newProduct = new Product({
    name,
    price,
    description,
    image: '/uploads/' + req.file.filename
  });
  await newProduct.save();
  res.redirect('/admin');
});

// Update Product
app.post('/admin/update/:id', isAuth, upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const updateData = {
    name: req.body.name,
    price: req.body.price,
    description: req.body.description
  };
  if (req.file) updateData.image = '/uploads/' + req.file.filename;
  await Product.findByIdAndUpdate(id, updateData);
  res.redirect('/admin');
});

// Delete Product
app.post('/admin/delete/:id', isAuth, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.redirect('/admin');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Public Page: http://localhost:${PORT}`);
  console.log(`Admin Login: http://localhost:${PORT}/login`);
});