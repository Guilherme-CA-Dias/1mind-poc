import mongoose from "mongoose";

export interface IRecord {
	id: string;
	name: string;
	createdTime?: string;
	updatedTime?: string;
	uri?: string;
	fields?: {
		domain?: string;
		industry?: string;
		[key: string]: any;
	};
	recordType: string;
	customerId: string;
	integrationKey?: string;
}

const recordSchema = new mongoose.Schema<IRecord>(
	{
		id: {
			type: String,
			required: true,
		},
		name: {
			type: String,
			required: true,
		},
		createdTime: String,
		updatedTime: String,
		uri: String,
		fields: {
			type: Map,
			of: mongoose.Schema.Types.Mixed,
			default: {},
		},
		recordType: {
			type: String,
			required: true,
			index: true,
		},
		customerId: {
			type: String,
			required: true,
			index: true,
		},
		integrationKey: {
			type: String,
			index: true,
		},
	},
	{
		timestamps: true,
	}
);

// Compound index for efficient queries
recordSchema.index({ customerId: 1, recordType: 1 });
recordSchema.index({ customerId: 1, recordType: 1, integrationKey: 1 });

// This creates a 'records' collection in the database specified in the connection string
// Force delete cached model to ensure schema changes are picked up
if (mongoose.models.Record) {
	delete mongoose.models.Record;
}

export const Record = mongoose.model<IRecord>("Record", recordSchema);
