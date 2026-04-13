import { Project } from '../core/models/project.model';

export const PROJECTS: Project[] = [
  {
    slug: 'banking-microservices-platform',
    title: 'Banking Microservices Platform',
    description:
      'Scalable backend microservices for digital banking, serving millions of customers across Georgia and Uzbekistan.',
    longDescription:
      'Architected and developed high-load microservices using .NET Core, following Domain-Driven Design and CQRS patterns. Integrated payment providers, implemented distributed caching, centralized logging, and automated CI/CD pipelines with containerization for reliable banking operations.',
    techStack: ['.NET Core', 'C#', 'DDD', 'CQRS', 'Docker', 'PostgreSQL', 'CI/CD'],
    image: '/images/tbc_uz.png',
    demoUrl: 'https://tbcbank.uz/',
    featured: true,
    category: 'web',
    year: 2025,
  },
  {
    slug: 'loan-management-system',
    title: 'Loan Management System',
    description:
      'Web-based retail and commercial loan processing system for a major Georgian bank.',
    longDescription:
      'Built full-stack loan management systems for Terabank covering retail and commercial products. Backend powered by .NET Core microservices and frontend built with React.js, Angular, and TypeScript. Deployed via Azure DevOps CI/CD pipelines.',
    techStack: ['.NET Core', 'C#', 'React.js', 'Angular', 'TypeScript', 'MSSQL', 'Azure DevOps'],
    image: '/images/tera.png',
    demoUrl: 'https://terabank.ge/en/retail',
    featured: true,
    category: 'web',
    year: 2023,
  },
  {
    slug: 'business-management-system',
    title: 'Business Management System',
    description:
      'Multilingual web-based management systems for store, hotel, and medical institutions.',
    longDescription:
      'Developed a suite of multilingual web-based management systems for FINA LTD, covering store management, hotel management, and medical institution management. Built with .NET Core backend, Angular and Razor frontend, and integrated with public and private services.',
    techStack: ['.NET Core', 'C#', 'Angular', 'Razor', 'TypeScript', 'MSSQL'],
    image: '/images/fina.jpg',
    demoUrl: 'https://fina.ge/en',
    featured: true,
    category: 'web',
    year: 2024,
  },
  {
    slug: 'test-automation-framework',
    title: 'Test Automation Framework',
    description:
      'End-to-end automation suite for payment and self-service terminal systems using Java and Selenium.',
    longDescription:
      'Built a comprehensive test automation framework at TBC Pay covering SSTS (Self-Service Terminal Systems) and EMS (Encashment Management System). Used Java, Selenium, Selenide, TestNG, and RestAssured for automated testing with full lifecycle management via Jira and TestRail.',
    techStack: ['Java', 'Selenium', 'Selenide', 'TestNG', 'RestAssured', 'Jira', 'TestRail'],
    image: '/images/tbc_pay.jpeg',
    demoUrl: 'https://tbcpay.ge/en/',
    featured: true,
    category: 'automation',
    year: 2022,
  },
  {
    slug: 'portfolio-website',
    title: 'Portfolio Website',
    description: 'A modern portfolio built with Angular 21, Tailwind CSS v4, and SSR.',
    longDescription:
      'A feature-rich portfolio site with SSR, dark mode, rich animations, and accessible design. Built with Angular 21 standalone components, signal-based state, and deployed to Vercel.',
    techStack: ['Angular', 'TypeScript', 'Tailwind CSS', 'SSR', 'Vitest', 'Playwright'],
    image: '/images/my-portfolio.svg',
    githubUrl: 'https://github.com/TatoTopuria/my-portfolio',
    demoUrl: 'https://tatotopuria.vercel.app/',
    featured: true,
    category: 'web',
    year: 2025,
  },
];
