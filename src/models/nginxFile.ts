import mongoose from "mongoose";

const nginxFileSchema = new mongoose.Schema(
  {
    publicId: {
      type: String,
      required: true,
      unique: true,
    },
    serverName: {
      type: String,
      required: true,
    },
    portNumber: {
      type: Number,
      required: true,
    },
    serverNameArrayOfAdditionalServerNames: [
      {
        type: String,
      },
    ],
    appHostServerMachineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Machine",
      required: true,
    },
    nginxHostServerMachineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Machine",
      required: true,
    },
    framework: {
      type: String,
    },
    storeDirectory: {
      type: String,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

export const NginxFile = mongoose.model("NginxFile", nginxFileSchema);
