import express from 'express'
import route from './routes/index.js';

const app=express();
app.use(express.json())
route(app);


app.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});