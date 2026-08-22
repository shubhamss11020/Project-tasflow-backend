import dotenv from 'dotenv';
dotenv.config();

// Ensure test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test_jwt_access_secret_1234567890123456';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_1234567890123456';

afterAll(async () => {
  // Graceful cleanup
});
