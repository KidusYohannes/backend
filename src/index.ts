import app from './app';

// Home page route
app.get('/', (req, res) => {
  res.send('Welcome to EdirConnect!');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
