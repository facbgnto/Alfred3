workspace "Software System" "C4 architecture model" {
    model {
        user = person "User" "Uses the system."

        softwareSystem = softwareSystem "Software System" {
            webapp = container "Web Application" "Provides the user interface." "React"
            api = container "API" "Provides business capabilities." "Node.js"
            database = container "Database" "Stores application data." "PostgreSQL"

            user -> webapp "Uses"
            webapp -> api "Calls" "HTTPS/JSON"
            api -> database "Reads and writes" "SQL"
        }
    }

    views {
        systemContext softwareSystem "SystemContext" {
            include *
            autoLayout lr
        }

        container softwareSystem "Containers" {
            include *
            autoLayout lr
        }

        styles {
            element "Person" {
                shape person
            }
            element "Container" {
                background #438dd5
                color #ffffff
            }
        }
    }
}
