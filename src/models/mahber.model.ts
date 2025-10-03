import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/db';

interface MahberAttributes {
  id: number;
  name: string;
  created_by: number;
  description?: string;
  profile?: string;
  stripe_account_id: string;
  stripe_product_id?: string; // <-- add this line
  stripe_price_id?: string; // new column for Stripe price ID
  //price id with processing fee for card payments
  stripe_price_fee_card_id?: string; // new column for Stripe price ID with card fee
  //price id with processing fee for ach payments
  stripe_price_fee_ach_id?: string; // new column for Stripe price ID with ACH fee
  stripe_status?: string; // new column for Stripe product status
  type?: string;
  contribution_unit?: string; // was contribution_period
  contribution_frequency?: string; // new column
  contribution_amount?: string;
  contribution_start_date?: string;
  affiliation?: string;
  created_at?: Date;
  updated_by?: number;
  updated_at?: Date;
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  bylaws?: string;
  zip_code?: string;
  visibility?: string; // new column for visibility
  featured?: string; // new column for featured status, 1 is on 0 is off
  promoted?: string; // new column for promoted status, 1 is on 0 is off
  processing_fee?: boolean; // virtual field
}

interface MahberCreationAttributes extends Optional<MahberAttributes, 'id'> {}

export class Mahber extends Model<MahberAttributes, MahberCreationAttributes> implements MahberAttributes {
  public id!: number;
  public name!: string;
  public created_by!: number;
  public description?: string;
  public profile?: string;
  public stripe_account_id!: string; // new column for Stripe account ID
  public stripe_product_id?: string; // <-- add this line
  public stripe_price_id?: string; // new column for Stripe price ID
  public stripe_price_fee_card_id?: string; // new column for Stripe price ID with card fee
  public stripe_price_fee_ach_id?: string; // new column for Stripe price ID with ACH fee
  public stripe_status?: string; // new column for Stripe product status
  public type?: string;
  public contribution_unit?: string; // was contribution_period
  public contribution_frequency?: string; // new column
  public contribution_amount?: string;
  public contribution_start_date?: string;
  public affiliation?: string;
  public created_at?: Date;
  public updated_by?: number;
  public updated_at?: Date;
  public country?: string;
  public state?: string;
  public city?: string;
  public address?: string;
  public bylaws?: string;
  public zip_code?: string;
  public visibility?: string; // new column for visibility
  public featured?: string; // new column for featured status, 1 is on 0 is off
  public promoted?: string; // new column for promoted status, 1 is on 0 is off
  public processing_fee?: boolean; // virtual field
}

Mahber.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    created_by: { type: DataTypes.INTEGER, allowNull: false },
    description: { type: DataTypes.STRING },
    profile: { type: DataTypes.STRING }, // new column for profile
    stripe_account_id: { type: DataTypes.STRING, allowNull: false }, // new column for Stripe account ID
    stripe_product_id: { type: DataTypes.STRING }, // <-- add this line
    stripe_price_id: { type: DataTypes.STRING }, // new column for Stripe price ID
    stripe_price_fee_card_id: { type: DataTypes.STRING }, // new column for Stripe price ID with card fee
    stripe_price_fee_ach_id: { type: DataTypes.STRING }, // new column for Stripe price ID with ACH fee
    stripe_status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'inactive' }, // default to 'inactive'
    type: { type: DataTypes.STRING },
    contribution_unit: { type: DataTypes.STRING },
    contribution_frequency: { type: DataTypes.STRING },
    contribution_amount: { type: DataTypes.STRING },
    contribution_start_date: { type: DataTypes.DATEONLY },
    affiliation: { type: DataTypes.STRING },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_by: { type: DataTypes.INTEGER },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    country: { type: DataTypes.STRING },
    state: { type: DataTypes.STRING },
    city: { type: DataTypes.STRING },
    address: { type: DataTypes.STRING },
    bylaws: { type: DataTypes.STRING },
    zip_code: { type: DataTypes.STRING },
    visibility: { type: DataTypes.STRING }, // new column for visibility
    featured: { type: DataTypes.STRING }, // new column for featured status, 1 is on 0 is off
    promoted: { type: DataTypes.STRING }, // new column for promoted status, 1 is on 0 is off
    processing_fee: {type: DataTypes.BOOLEAN, defaultValue: false} // virtual field
  },
  {
    sequelize,
    tableName: 'mahber',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
);
