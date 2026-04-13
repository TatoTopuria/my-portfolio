import { Experience } from '../core/models/experience.model';

export const EXPERIENCE: Experience[] = [
  {
    id: 'tbc-uzbekistan',
    company: 'TBC Uzbekistan',
    role: 'Software Engineer',
    startDate: '2025-11',
    endDate: 'Present',
    location: 'Remote',
    description:
      'Designing, building, and supporting scalable backend systems at one of the fastest-growing digital banks in Central Asia, using .NET Core within a microservices-based architecture.',
    highlights: [
      'Designed and built scalable backend systems using .NET Core and microservices architecture following DDD and CQRS best practices',
      'Implemented secure integrations with payment providers and external systems, ensuring reliable transaction processing and regulatory compliance in the Georgian and Uzbek markets',
      'Established centralized logging and monitoring solutions to quickly detect, diagnose, and resolve performance issues in high-load systems serving millions of customers',
      'Improved system stability and data integrity by applying distributed caching strategies and resilient design patterns in critical banking services',
      'Built and optimized automated CI/CD pipelines using containerization, accelerating deployment processes for banking features',
    ],
    techStack: ['.NET Core', 'C#', 'Microservices', 'DDD', 'CQRS', 'Docker', 'PostgreSQL', 'CI/CD'],
  },
  {
    id: 'space-international',
    company: 'Space International',
    role: 'Software Developer',
    startDate: '2024-08',
    endDate: '2025-12',
    location: 'Georgia',
    description:
      'Developed and maintained scalable backend services for fintech products using .NET Core and microservices architecture, serving millions of active users across multiple markets.',
    highlights: [
      'Developed and maintained scalable backend services using .NET Core and microservices architecture',
      'Implemented clean and maintainable code following DDD and CQRS principles',
      'Integrated secure payment gateways and third-party services, ensuring seamless transaction processing and regulatory compliance across Georgian and Uzbek markets',
      'Centralized logging and monitoring infrastructure, enabling rapid identification and resolution of system performance issues for millions of users',
      'Devised automated deployment pipelines leveraging containerization technologies, streamlining release cycles and ensuring consistent delivery of critical banking features',
    ],
    techStack: ['.NET Core', 'C#', 'Microservices', 'DDD', 'CQRS', 'Docker', 'PostgreSQL'],
  },
  {
    id: 'fina-ltd',
    company: 'FINA LTD',
    role: 'Full Stack Developer',
    startDate: '2024-02',
    endDate: '2024-08',
    location: 'Tbilisi, Georgia',
    description:
      'FINA creates and offers customers business management and accounting software. Worked on web-based store management, hotel management, and medical institution management systems — all multilingual.',
    highlights: [
      'Developed web-based store, hotel, and medical institution management systems with multilingual support',
      'Built backend services with .NET Core and frontend interfaces with Angular and Razor',
      'Integrated various public and private services to enhance system functionality',
      'Collaborated efficiently within a team of 10 developers, ensuring smooth development and deployment on IIS Express',
    ],
    techStack: ['.NET Core', 'C#', 'Angular', 'TypeScript', 'Razor', 'MSSQL'],
  },
  {
    id: 'terabank',
    company: 'Terabank',
    role: 'Software Developer',
    startDate: '2023-05',
    endDate: '2024-02',
    location: 'Tbilisi, Georgia',
    description:
      "Developed web-based loan systems for one of Georgia's leading universal banks, serving both retail and commercial customers with modern microservices technologies.",
    highlights: [
      'Built retail and commercial loan systems using .NET Core microservices architecture',
      'Developed frontend interfaces with React.js, Angular, and TypeScript',
      'Utilized Azure and Azure DevOps for version control and CI/CD pipelines',
      'Worked with MSSQL for data management and reporting across loan products',
    ],
    techStack: ['.NET Core', 'C#', 'React.js', 'Angular', 'TypeScript', 'MSSQL', 'Azure DevOps'],
  },
  {
    id: 'tbc-pay',
    company: 'TBC Pay',
    role: 'Test Automation Engineer',
    startDate: '2021-07',
    endDate: '2023-05',
    location: 'Tbilisi, Georgia',
    description:
      'Handled manual and automated testing for payment and self-service terminal systems at TBC PAY, a leading Georgian payment market operator enabling customers to pay instantly for services.',
    highlights: [
      'Automated tests for SSTS (Self-Service Terminal Systems) and EMS (Encashment Management System)',
      'Built automation test suites using Java, Selenium, Selenide, TestNG, and RestAssured',
      'Created manual test cases, test plans, test suites, and test scripts',
      'Supervised and mentored 3 junior QA engineers',
      'Managed full test lifecycle with Jira, TestRail, and Postman',
    ],
    techStack: [
      'Java',
      'Selenium',
      'Selenide',
      'TestNG',
      'RestAssured',
      'Jira',
      'TestRail',
      'Postman',
    ],
  },
];
