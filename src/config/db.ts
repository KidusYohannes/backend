import { Sequelize } from 'sequelize';


const sequelize = new Sequelize('mydb', 'postgres', 'root', {
  host: 'localhost',
  dialect: 'postgres',
  port: 5432,
  logging: false,
});

export default sequelize;
