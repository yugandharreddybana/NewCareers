SET search_path TO careerops;
UPDATE users
SET password_hash = '$2b$10$IHxaaMWKd/byJ8IJRd4XM.Pw9RjfP7GbOkHyXqQyDbTkyIFhTn68i'
WHERE lower(email) = 'test@newcareer.com';
