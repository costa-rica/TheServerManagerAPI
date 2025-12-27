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

    servicesArray: [
      {
        name: {
          type: String,
          required: false,
        },
        filename: {
          type: String,
          required: true,
        },
        filenameTimer: {
          type: String,
          required: false,
        },
        workingDirectory: {
          type: String,
          required: false,
        },
        port: {
          type: Number,
          required: false,
        },
        pathToLogs: {
          type: String,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

export const Machine = mongoose.model("Machine", machineSchema);
