import mongoose from "mongoose";

interface MongooseCache {
	conn: typeof mongoose | null;
	promise: Promise<typeof mongoose> | null;
}

declare global {
	// eslint-disable-next-line no-var
	var mongoose: MongooseCache | undefined;
}

const MONGODB_URI =
	process.env.MONGODB_URI || "mongodb://localhost:27017/1mind";

if (!MONGODB_URI) {
	throw new Error(
		"Please define the MONGODB_URI environment variable inside .env"
	);
}

const cached: MongooseCache = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
	global.mongoose = cached;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
	if (cached.conn) {
		return cached.conn;
	}

	if (!cached.promise) {
		const opts = {
			bufferCommands: false,
			serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
			socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
			family: 4, // Use IPv4, skip trying IPv6
		};

		cached.promise = mongoose.connect(MONGODB_URI, opts);
	}

	try {
		cached.conn = await cached.promise;
		console.log("Successfully connected to MongoDB");
		return cached.conn;
	} catch (e) {
		cached.promise = null;
		console.error("MongoDB connection error:", e);
		throw e;
	}
}

// For backwards compatibility
export default connectToDatabase;
