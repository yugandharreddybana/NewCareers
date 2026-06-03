SET search_path TO careerops;

-- R__seed_irish_companies.sql
-- Repeatable migration to keep the irish_companies reference table synchronized across environments.

CREATE TABLE IF NOT EXISTS irish_companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    careers_url TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed/Synchronize Irish Tech Companies Reference Data
INSERT INTO irish_companies (name, careers_url, category) VALUES
('Google', 'https://careers.google.com/jobs/results/?location=Dublin%2C+Ireland', 'Big Tech'),
('Meta', 'https://www.metacareers.com/jobs?offices[0]=Dublin%2C+Ireland', 'Big Tech'),
('Microsoft', 'https://jobs.microsoft.com/en-us/search?location=Dublin%2C+Ireland', 'Big Tech'),
('Apple', 'https://jobs.apple.com/en-ie/search#&t=1&so=&l=Dublin', 'Big Tech'),
('Amazon', 'https://www.amazon.jobs/en/search?base_query=software&location=Dublin%2C+Ireland', 'Big Tech'),
('Stripe', 'https://stripe.com/jobs/search?office=dublin', 'Big Tech'),
('Intercom', 'https://boards.greenhouse.io/intercom', 'Big Tech'),
('Teamwork', 'https://www.teamwork.com/careers/', 'Irish Scale-up'),
('Version 1', 'https://www.version1.com/careers/current-vacancies/', 'Irish Scale-up'),
('Wayflyer', 'https://www.wayflyer.com/careers', 'Irish Scale-up'),
('Fenergo', 'https://fenergo.com/careers/', 'Irish Scale-up'),
('Revolut', 'https://www.revolut.com/en-IE/careers/', 'Fintech'),
('Atlassian', 'https://www.atlassian.com/company/careers/all-jobs#search&location=Dublin%2C+Ireland', 'SaaS'),
('MongoDB', 'https://www.mongodb.com/company/careers/departments', 'SaaS'),
('Cloudflare', 'https://www.cloudflare.com/careers/jobs/?location=Dublin%2C+Ireland', 'SaaS'),
('EY', 'https://careers.ey.com/ey/search/#?location=ireland', 'Professional Services')
ON CONFLICT (name) DO UPDATE SET 
    careers_url = EXCLUDED.careers_url,
    category = EXCLUDED.category;

