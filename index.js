require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const multer = require('multer');
const app = express();

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.log(err));

// Owner Schema (now includes hero background)
const ownerSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  address: String,
  photo: String,
  heroBg: { type: String, default: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1950&q=80" }
});
const Owner = mongoose.model('Owner', ownerSchema);

// Product Schema
const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  description: String,
  image: String
});
const Product = mongoose.model('Product', productSchema);

// Create default owner if not exists
Owner.findOne().then(async (owner) => {
  if (!owner) {
    await new Owner({
      name: "Kaushal Ediyar",
      email: "kaushalediyar@gmail.com",
      phone: "+977 9825388045",
      address: "Ramdhuni-7, Nepal",
      photo: "https://i.ibb.co/0jY7Z7K/kaushal-photo.jpg"
    }).save();
    console.log("Default owner created");
  }
});

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(session({
  secret: process.env.SESSION_SECRET,
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
  res.render('public', { products, owner });
});

app.get('/login', (req, res) => res.render('login', { error: null }));

app.post('/login', (req, res) => {
  if (req.body.username === "Kaushal" && req.body.password === "kaushal123") {
    req.session.isAuth = true;
    return res.redirect('/admin');
  }
  res.render('login', { error: "Wrong username or password" });
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

app.get('/admin', isAuth, async (req, res) => {
  const [products, owner] = await Promise.all([Product.find(), Owner.findOne()]);
  res.render('admin', { products, owner });
});

// CRUD Routes
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

// Update Profile + Hero Background
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit: https://kaushal-ediyar.onrender.com`);
});