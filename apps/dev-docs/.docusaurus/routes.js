import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/dev-docs/search',
    component: ComponentCreator('/dev-docs/search', '93a'),
    exact: true
  },
  {
    path: '/dev-docs/',
    component: ComponentCreator('/dev-docs/', '97a'),
    routes: [
      {
        path: '/dev-docs/',
        component: ComponentCreator('/dev-docs/', '1f5'),
        routes: [
          {
            path: '/dev-docs/',
            component: ComponentCreator('/dev-docs/', 'a87'),
            routes: [
              {
                path: '/dev-docs/apps/backend',
                component: ComponentCreator('/dev-docs/apps/backend', 'f5e'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/dev-docs/apps/frontend',
                component: ComponentCreator('/dev-docs/apps/frontend', '1bc'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/dev-docs/apps/mobile-app',
                component: ComponentCreator('/dev-docs/apps/mobile-app', 'eee'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/dev-docs/guides/backend-chat',
                component: ComponentCreator('/dev-docs/guides/backend-chat', 'be6'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/dev-docs/guides/notification-setup',
                component: ComponentCreator('/dev-docs/guides/notification-setup', '6c6'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/dev-docs/policies/code-of-conduct',
                component: ComponentCreator('/dev-docs/policies/code-of-conduct', '3df'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/dev-docs/policies/contributing',
                component: ComponentCreator('/dev-docs/policies/contributing', '29a'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/dev-docs/policies/security',
                component: ComponentCreator('/dev-docs/policies/security', '4e5'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/dev-docs/',
                component: ComponentCreator('/dev-docs/', '1bf'),
                exact: true,
                sidebar: "docs"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
