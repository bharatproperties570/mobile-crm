import React from 'react';
import { UserProvider } from '../context/UserContext';
import { ProjectProvider } from '../context/ProjectContext';
import { LookupProvider } from '../context/LookupContext';
import { DepartmentProvider } from '../context/DepartmentContext';
import { NotificationProvider } from '../context/NotificationContext';
import { CallTrackingProvider } from '../context/CallTrackingContext';

export const EnterpriseProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <NotificationProvider>
            <UserProvider>
                <ProjectProvider>
                    <LookupProvider>
                        <DepartmentProvider>
                            <CallTrackingProvider>
                                {children}
                            </CallTrackingProvider>
                        </DepartmentProvider>
                    </LookupProvider>
                </UserProvider>
            </NotificationProvider>
        </NotificationProvider>
    );
};
