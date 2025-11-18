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
    component: ComponentCreator('/dev-docs/', '172'),
    routes: [
      {
        path: '/dev-docs/',
        component: ComponentCreator('/dev-docs/', '638'),
        routes: [
          {
            path: '/dev-docs/',
            component: ComponentCreator('/dev-docs/', '58d'),
            routes: [
              {
                path: '/dev-docs/apps/backend',
                component: ComponentCreator('/dev-docs/apps/backend', '1b2'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/dev-docs/apps/frontend',
                component: ComponentCreator('/dev-docs/apps/frontend', '602'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/dev-docs/apps/mobile-app',
                component: ComponentCreator('/dev-docs/apps/mobile-app', '0b5'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/dev-docs/guides/backend-chat',
                component: ComponentCreator('/dev-docs/guides/backend-chat', '4cb'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/dev-docs/guides/notification-setup',
                component: ComponentCreator('/dev-docs/guides/notification-setup', '16e'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/dev-docs/policies/code-of-conduct',
                component: ComponentCreator('/dev-docs/policies/code-of-conduct', 'a8d'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/dev-docs/policies/contributing',
                component: ComponentCreator('/dev-docs/policies/contributing', '118'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/dev-docs/policies/security',
                component: ComponentCreator('/dev-docs/policies/security', 'b00'),
                exact: true,
                sidebar: "docs"
              },
              {
                path: '/dev-docs/',
                component: ComponentCreator('/dev-docs/', '0fd'),
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
