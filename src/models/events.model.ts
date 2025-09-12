import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/db';

interface EventsAttributes {
    id: number;
    mahber_id: number;
    title: string;
    description: string;
    location: string;
    start_time: Date;
    end_time?: Date;
    rsvp_deadline?: Date;
    created_by: number;
    is_public: boolean;
    last_updated_by: number;
}

interface EventsCreationAttributes extends Optional<EventsAttributes, 'id'> {}

class Events extends Model<EventsAttributes, EventsCreationAttributes> implements EventsAttributes {
  public id!: number;
  public mahber_id!: number;
  public title!: string;
  public description!: string;
  public location!: string;
  public start_time!: Date;
  public end_time?: Date;
  public rsvp_deadline?: Date;
  public created_by!: number;
  public last_updated_by!: number;
  public is_public!: boolean;
}

Events.init(
  {
    id: {type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true},
    mahber_id: {type: DataTypes.INTEGER, allowNull: false},
    title: {type: DataTypes.STRING, allowNull: false},
    description: {type: DataTypes.TEXT, allowNull: true},
    location: {type: DataTypes.STRING, allowNull: false},
    start_time: {type: DataTypes.DATE, allowNull: false},
    end_time: {type: DataTypes.DATE, allowNull: true},
    rsvp_deadline: {type: DataTypes.DATE, allowNull: true},
    created_by: {type: DataTypes.INTEGER, allowNull: false},
    is_public: {type: DataTypes.BOOLEAN, allowNull: false},
    last_updated_by: {type: DataTypes.INTEGER, allowNull: true}
  },
  {
    sequelize,
    modelName: 'events'
  }
);

export default Events;
