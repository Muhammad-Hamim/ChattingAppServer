import { TGenericErrorResponse } from "../interface/error";

export const handleDuplicateIdError = (err: any): TGenericErrorResponse => {
  const match = err.message.match(/"([^"]*)"/);
  const extractedMessage = match && match[1];
  const errorSources = [
    {
      path: err.keyValue.name,
      message: `${extractedMessage} is already exist`,
    },
  ];
  const statusCode = 400;
  return {
    statusCode,
    message: "validation error",
    errorSources,
  };
};
