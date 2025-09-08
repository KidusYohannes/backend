import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/db';

interface EventsRsvpAttributes {
    id: number;
    event_id: number;
    user_id: number;
    status: 'yes' | 'no' | 'maybe';
    created_at: Date;
    updated_at: Date;
}

interface EventsRsvpCreationAttributes extends Optional<EventsRsvpAttributes, 'id'> {}

class EventsRsvp extends Model<EventsRsvpAttributes, EventsRsvpCreationAttributes> implements EventsRsvpAttributes {
    public id!: number;
    public event_id!: number;
    public user_id!: number;
    public status!: 'yes' | 'no' | 'maybe';
    public created_at!: Date;
    public updated_at!: Date;
}

EventsRsvp.init(
    {
        id: {type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true},
        event_id: {type: DataTypes.INTEGER, allowNull: false},
        user_id: {type: DataTypes.INTEGER, allowNull: false},
        status: {type: DataTypes.ENUM('yes', 'no', 'maybe'), allowNull: false},
        created_at: {type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW},
        updated_at: {type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW}
    },
    {
        sequelize,
        modelName: 'events_rsvp'
    }
);

export default EventsRsvp;
