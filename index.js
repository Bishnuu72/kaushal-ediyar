require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const fileUpload = require('express-fileupload');
const { v2: cloudinary } = require('cloudinary');
const app = express();

// Cloudinary Config (from Render env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// MongoDB Connect
mongoose.connect(process.env.MONGODB_URI).then(() => console.log('MongoDB Connected'));

// Owner Schema (added version: false to fix error)
const ownerSchema = new mongoose.Schema({
  name: String,
  tagline: String,
  email: String,
  phone: String,
  address: String,
  photo: String,
  heroBg: String
}, { versionKey: false }); // ← THIS FIXES THE ERROR

const Owner = mongoose.model('Owner', ownerSchema);

// Product Schema
const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  description: String,
  image: String,
  order: { type: Number, default: 0 }
}, { versionKey: false });

const Product = mongoose.model('Product', productSchema);

// Default owner
Owner.findOne().then(async (owner) => {
  if (!owner) {
    await new Owner({
      name: "Kaushal Ediyar",
      tagline: "Distributor of Azul Products - Spectra HealthCare",
      email: "kaushalediyar@gmail.com",
      phone: "+977 9825388045",
      address: "Ramdhuni-7, Nepal",
      photo: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      heroBg: "https://res.cloudinary.com/demo/image/upload/samples/landscapes/beach-boat.jpg"
    }).save();
    console.log("Default owner created");
  }
});

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(fileUpload());
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false
}));

const isAuth = (req, res, next) => req.session.isAuth ? next() : res.redirect('/login');

// Routes
app.get('/', async (req, res) => {
  const [products, owner] = await Promise.all([
    Product.find().sort('order'),
    Owner.findOne()
  ]);
  res.render('public', { products, owner: owner || {} });
});

app.get('/login', (req, res) => res.render('login', { error: null }));

app.post('/login', (req, res) => {
  if (req.body.username === "Kaushal" && req.body.password === "kaushal123") {
    req.session.isAuth = true;
    res.redirect('/admin');
  } else {
    res.render('login', { error: "Wrong username or password" });
  }
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

app.get('/admin', isAuth, async (req, res) => {
  const [products, owner] = await Promise.all([
    Product.find().sort('order'),
    Owner.findOne()
  ]);
  res.render('admin', { products, owner: owner || {} });
});

// Cloudinary Upload Function
const uploadToCloudinary = (file) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(file.tempFilePath || file.path, {
      folder: "kaushal-products"
    }, (error, result) => {
      if (error) reject(error);
      else resolve(result.secure_url);
    });
  });
};

// Add Product
app.post('/admin/add', isAuth, async (req, res) => {
  try {
    const imageUrl = await uploadToCloudinary(req.files.image);
    const maxOrder = await Product.findOne().sort('-order').exec();
    await new Product({
      name: req.body.name,
      price: req.body.price,
      description: req.body.description,
      image: imageUrl,
      order: (maxOrder?.order || 0) + 1
    }).save();
    res.redirect('/admin');
  } catch (err) {
    console.log(err);
    res.status(500).send("Upload failed");
  }
});

// Update Product
app.post('/admin/update/:id', isAuth, async (req, res) => {
  try {
    const update = { ...req.body };
    if (req.files?.image) {
      update.image = await uploadToCloudinary(req.files.image);
    }
    await Product.findByIdAndUpdate(req.params.id, update);
    res.redirect('/admin');
  } catch (err) {
    res.status(500).send("Update failed");
  }
});

// Delete Product
app.post('/admin/delete/:id', isAuth, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.redirect('/admin');
});

// Update Profile (FIXED THIS LINE — THIS WAS THE ERROR!)
app.post('/admin/update-profile', isAuth, async (req, res) => {
  try {
    const update = { ...req.body };
    if (req.files?.photo) update.photo = await uploadToCloudinary(req.files.photo);
    if (req.files?.heroBg) update.heroBg = await uploadToCloudinary(req.files.heroBg);

    // FIXED: Use replaceOne instead of findOneAndUpdate with upsert
    await Owner.replaceOne({}, update, { upsert: true });
    res.redirect('/admin');
  } catch (err) {
    console.log(err);
    res.status(500).send("Profile update failed");
  }
});

// Reorder
app.post('/admin/reorder', isAuth, async (req, res) => {
  const orders = req.body.order || [];
  for (let i = 0; i < orders.length; i++) {
    await Product.findByIdAndUpdate(orders[i], { order: i });
  }
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SERVER LIVE ON PORT ${PORT}`);
  console.log(`Visit: https://kaushal-ediyar.onrender.com`);
});