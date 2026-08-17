import {
  withLambda,
  type HandlerResponse,
  type LambdaHandler,
} from "@netlify/aws-lambda-compat";
import serverless from "serverless-http";
import { connectLambda } from "@netlify/blobs";
import { createApp } from "../../server/src/app.js";
import { GoogleSheetsBelgaRepository } from "../../server/src/belga/GoogleSheetsBelgaRepository.js";

const repository = new GoogleSheetsBelgaRepository();
type ServerlessHandler = ReturnType<typeof serverless>;

let handlerPromise: Promise<ServerlessHandler> | undefined;

function getExpressHandler(): Promise<ServerlessHandler> {
  handlerPromise ??= repository
    .initialize()
    .then(() => serverless(createApp(repository)));
  return handlerPromise;
}

const lambdaHandler: LambdaHandler = async (event, context) => {
  connectLambda(event as unknown as Parameters<typeof connectLambda>[0]);
  const expressHandler = await getExpressHandler();
  return expressHandler(event, context) as Promise<HandlerResponse>;
};

export default withLambda(lambdaHandler);
