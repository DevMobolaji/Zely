import { GraphQLError } from 'graphql';
import HttpException, { ErrorOutput } from '../../infrastructure/errors/customAPIError';


export const formatGraphQLError = (error: GraphQLError): GraphQLError => {
    // Check if the original error (thrown in the resolver) is our custom exception
    const originalError = error.originalError;

    if (originalError instanceof HttpException) {
        // Use the structured output from the custom error
        const structuredErrors: ErrorOutput[] = originalError.serializeErrors();

        // Take the first structured error for the main message and extensions
        const firstError = structuredErrors[0];

        // The main GraphQLError message
        error.message = firstError.message;

        // Apply structured metadata to the 'extensions' field
        // This is what carries the HTTP status and custom codes to the client.
        Object.assign(error.extensions, {
            code: firstError.code || 'CUSTOM_ERROR',
            http: {
                status: firstError.status || 500,
            },
            details: firstError.extension || {},
        });

        return error;
    }

    // For unknown or generic errors (like syntax errors, internal crashes)
    return new GraphQLError(
        error.message,
        {
            extensions: {
                code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
                http: {
                    status: 500,
                },
            }
        }
    );
};