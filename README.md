<p align="center">
  <a href="https://yosemitecrew.com/">
    <img src="https://d1g0w8b65hklyd.cloudfront.net/YC.svg" width="200px" alt="YC logo" />
  </a>
</p>

<h1 align="center" >Open-Source Operating System for Animal Health</h1>

<div align="center"> 
  
  [![Website](https://img.shields.io/badge/Yosemite%20Crew-D04122)](https://yosemitecrew.com/) [![Documentation](https://img.shields.io/badge/Docs-247AED)](https://yosemitecrew.com/) [![Contributing](https://img.shields.io/badge/Contribute-FF9800)](https://github.com/YosemiteCrew/Yosemite-Crew/blob/main/CONTRIBUTING.md) [![Github License](https://img.shields.io/badge/License-4CAF50)](License) [![Discord](https://img.shields.io/badge/Discord-lightblue?logo=discord)](https://discord.gg/R7eMnhwX)
  
</div>

<br>

<p align="center">
  <a href="https://yosemitecrew.com/">
      <img src="https://d1g0w8b65hklyd.cloudfront.net/Dashboard_2.png" alt="YC logo" />
  </a>
</p>

<br>

# 📝 Overview
Yosemite Crew is an open-source operating system designed for animal health industry. At its core is a free, fully customizable Practice Management System (PMS) that unifies pet care operations, bringing together pet owners, pet businesses, and developers into one innovative ecosystem.

For Pet Owners

- **Ultimate Convenience:** A user-friendly mobile app enables pet owners to effortlessly schedule appointments, conduct virtual consultations, manage pet health records, and access a wealth of resources.
- **Enhanced Accessibility:** Whether in remote locations or facing mobility challenges, pet owners can tap into quality veterinary care anytime, anywhere.

For Veterinary Clinics and Pet Care Providers

- **Streamlined Efficiency:** Yosemite Crew simplifies appointment scheduling and enhances communication, reducing administrative burdens and boosting overall productivity.
- **Customization & Integration:** As an open-source solution, the platform offers unmatched flexibility, allowing clinics to tailor the system to their unique needs without being locked into rigid subscription models. Seamless integration with existing systems further reduces barriers to adoption.
- **Robust Security & Compliance:** With comprehensive data management, reporting capabilities, and adherence to regulatory standards, the system ensures that sensitive information remains secure and that clinics can make informed, data-driven decisions.
- **Scalability & Support:** Designed to grow alongside veterinary practices, Yosemite Crew is scalable and supported by regular updates and a vibrant community of contributors, ensuring the platform remains state-of-the-art.

For Developers

- **Empowering Innovation:** The dedicated developer portal is at the heart of an ecosystem that mirrors the versatility of the WordPress plugin model.
- **Flexible Development Environment:** Equipped with robust public APIs, comprehensive documentation, and ready-to-use MVP templates, developers can quickly create, install, and manage custom plugins that extend the platform's core functionalities.
- **Community-Driven Growth:** This open-source approach fosters a collaborative environment where developers can continuously innovate and expand veterinary care options, driving the evolution of animal healthcare technology.

<br>

# 💻 Installation

### Prerequisites
- Git
- Node.js
  
### Steps
- Create a fork from Yosemite-Crew repository as it is described in GitHub docs. You can skip this step if you want to just run the project and not contribute.
- Clone your forked repository to your local machine using `git clone`. Clone dev branch if want to use the bleeding edge version.
 
     ```shell
     git clone https://github.com/yourusername/Yosemite-Crew.git
     git clone -b dev https://github.com/yourusername/Yosemite-Crew.git
     
     cd Yosemite-Crew
     ```
     
- Install the project dependencies.

     ```shell
     npm ci
     ```
     
- Run the project.

     ```shell
     npx nx serve website                    -- Run the website
     npx nx serve api                        -- Run the api
     npx nx run-android mobileapp            -- Run the app on android
     npx nx run-ios mobileapp                -- Run the app on IOS
     ```

<br>

# 🚀 Our Tech Stack
- [TypeScript](https://www.typescriptlang.org/) for type safety
- [Nx](https://nx.dev/) for a powerful monorepo structure and efficient build system
- [Express](https://expressjs.com/)  as a backend framework, with [MongoDB](https://www.mongodb.com/) for data storage, [Redis](https://redis.io/)  for lightning-fast caching
- [React](https://reactjs.org/) for the frontend, with [Redux](https://redux.js.org/) for state management
- [React Native](https://reactnative.dev/) for mobile app development
- [AWS](https://aws.amazon.com) to ensure reliable and scalable cloud infrastructure

<br>

# 💬 Join Our Growing Community
- Star our repo and show your support!
- Follow us on [Twitter](https://github.com/YosemiteCrew/Yosemite-Crew) or [LinkedIn](https://www.linkedin.com/company/yosemitecrew/) to get all the latest news
- Join our [Discord](https://discord.com/invite/yosemite-crew) to chat with fellow contributors and users
- [Contribute](https://github.com/YosemiteCrew/Yosemite-Crew/blob/main/CONTRIBUTING.md) — we love contributions! Whether it’s code, docs, or ideas, your help is always welcome!

<br>

# ⭐ Star History

<a href="https://star-history.com/#YosemiteCrew/Yosemite-Crew&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=YosemiteCrew/Yosemite-Crew&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=YosemiteCrew/Yosemite-Crew&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=YosemiteCrew/Yosemite-Crew&type=Date" />
 </picture>
</a>




