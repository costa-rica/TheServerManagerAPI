import mongoose from "mongoose";

const machineSchema = new mongoose.Schema(
  {
    publicId: {
      type: String,
      required: true,
      unique: true,
    },
    machineName: {
      type: String,
      required: true,
    },
    urlFor404Api: {
      type: String,
      required: true,
    },
    localIpAddress: {
      type: String,
      required: true,
    },
    nginxStoragePathOptions: [
      {
        type: String,
      },
    ],
    pathToLogs: {
      type: String,
      required: true,
    },
    servicesArray: [
      {
        name: {
          type: String,
          required: true,
        },
        filename: {
          type: String,
          required: true,
        },
        filenameTimer: {
          type: String,
          required: false,
        },
        port: {
          type: Number,
          required: false,
        },
      },
    ],
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

export const Machine = mongoose.model("Machine", machineSchema);
