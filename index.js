require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const fileUpload = require('express-fileupload');
const { v2: cloudinary } = require('cloudinary');

const app = express();

// === CLOUDINARY (FROM RENDER ENV) ===
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// === MONGOOSE CONNECT (FIXED — NO DEPRECATED OPTIONS) ===
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => {
    console.error('MongoDB Connection Error:', err.message);
    process.exit(1);
  });

// === SCHEMAS ===
const ownerSchema = new mongoose.Schema({
  name: String,
  tagline: String,
  email: String,
  phone: String,
  address: String,
  photo: { type: String, default: "https://res.cloudinary.com/demo/image/upload/sample.jpg" },
  heroBg: { type: String, default: "https://res.cloudinary.com/demo/image/upload/samples/landscapes/beach-boat.jpg" }
}, { versionKey: false });

const Owner = mongoose.model('Owner', ownerSchema);

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  description: String,
  image: String,
  order: { type: Number, default: 0 }
}, { versionKey: false });

const Product = mongoose.model('Product', productSchema);

// === DEFAULT OWNER (ONLY ONCE) ===
Owner.findOne().then(async (owner) => {
  if (!owner) {
    await new Owner({
      name: "Kaushal Ediyar",
      tagline: "Distributor of Azul Products - Spectra HealthCare",
      email: "kaushalediyar@gmail.com",
      phone: "+977 9825388045",
      address: "Ramdhuni-7, Nepal"
    }).save();
    console.log("Default owner created");
  }
});

// === MIDDLEWARE ===
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  abortOnLimit: true
}));
app.use(session({
  secret: process.env.SESSION_SECRET || 'kaushal_secret_2025',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

const isAuth = (req, res, next) => req.session.isAuth ? next() : res.redirect('/login');

// === ROUTES ===
app.get('/', async (req, res) => {
  try {
    const [products, owner] = await Promise.all([
      Product.find().sort('order'),
      Owner.findOne()
    ]);
    res.render('public', { products, owner: owner || {} });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.get('/login', (req, res) => res.render('login', { error: null }));

app.post('/login', (req, res) => {
  if (req.body.username === "Kaushal" && req.body.password === "kaushal123") {
    req.session.isAuth = true;
    return res.redirect('/admin');
  }
  res.render('login', { error: "Wrong username or password" });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/admin', isAuth, async (req, res) => {
  try {
    const [products, owner] = await Promise.all([
      Product.find().sort('order'),
      Owner.findOne()
    ]);
    res.render('admin', { products, owner: owner || {} });
  } catch (err) {
    res.status(500).send("Error loading admin");
  }
});

// === CLOUDINARY UPLOAD (100% WORKING ON RENDER) ===
const uploadToCloudinary = async (file) => {
  if (!file || !file.tempFilePath) throw new Error("No file uploaded");
  const result = await cloudinary.uploader.upload(file.tempFilePath, {
    folder: "kaushal-products",
    use_filename: true,
    unique_filename: false
  });
  return result.secure_url;
};

// Add Product
app.post('/admin/add', isAuth, async (req, res) => {
  try {
    if (!req.files?.image) return res.status(400).send("Image is required");
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
    console.error("Add Product Error:", err);
    res.status(500).send(`Upload failed: ${err.message}`);
  }
});

// Update Product
app.post('/admin/update/:id', isAuth, async (req, res) => {
  try {
    const update = { name: req.body.name, price: req.body.price, description: req.body.description };
    if (req.files?.image) update.image = await uploadToCloudinary(req.files.image);
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

// Update Profile
app.post('/admin/update-profile', isAuth, async (req, res) => {
  try {
    const update = { ...req.body };
    if (req.files?.photo) update.photo = await uploadToCloudinary(req.files.photo);
    if (req.files?.heroBg) update.heroBg = await uploadToCloudinary(req.files.heroBg);
    await Owner.replaceOne({}, update, { upsert: true });
    res.redirect('/admin');
  } catch (err) {
    res.status(500).send("Profile update failed");
  }
});

// Reorder Products
app.post('/admin/reorder', isAuth, async (req, res) => {
  try {
    const orders = req.body.order || [];
    for (let i = 0; i < orders.length; i++) {
      await Product.findByIdAndUpdate(orders[i], { order: i });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// === START SERVER ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`SERVER LIVE ON PORT ${PORT}`);
  console.log(`Visit: https://kaushal-ediyar.onrender.com`);
});