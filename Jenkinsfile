// Ejecuta un comando dentro de node:20-alpine SIN el plugin Docker Pipeline.
// Jenkins corre en un contenedor, por eso se comparte su volumen con --volumes-from.
def inNode(String cmd, String extraEnv = '') {
    sh """
        docker run --rm \\
          -u \$(id -u):\$(id -g) \\
          --volumes-from \$(hostname) \\
          -w "\$WORKSPACE" \\
          -e HOME="\$WORKSPACE" \\
          -e npm_config_cache="\$WORKSPACE/.npm" \\
          -e DATABASE_URL -e JWT_SECRET -e CI \\
          ${extraEnv} \\
          node:20-alpine sh -c '${cmd}'
    """
}

pipeline {
    agent any

    options {
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
    }

    parameters {
        booleanParam(name: 'RUN_SONAR', defaultValue: true,
                     description: 'Ejecutar análisis en SonarQube local')
        string(name: 'SONARQUBE_JENKINS_SERVER',
               defaultValue: 'SonarQubeLocal',
               description: 'Nombre del servidor SonarQube configurado en Manage Jenkins > System > SonarQube servers')
        string(name: 'SONAR_DOCKER_NETWORK',
               defaultValue: '',
               description: 'Red de Docker donde corre SonarQube (opcional, ej. devops-net)')
        booleanParam(name: 'PUSH_IMAGE', defaultValue: true,
                     description: 'Publicar la imagen en Docker Hub (solo rama main)')
    }

    environment {
        IMAGE_NAME   = 'homara-backend'
        CI           = 'true'
        // Valores ficticios solo para CI: prisma generate y los tests no se conectan a una BD real
        DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/homara?schema=public'
        JWT_SECRET   = 'jenkins_ci_secret'
    }

    stages {

        stage('Instalar dependencias') {
            steps {
                script { inNode('node --version && npm --version && npm ci') }
            }
        }

        stage('Tests + cobertura (Vitest)') {
            steps {
                // Incluye prisma generate (definido en el script test:coverage)
                script { inNode('npm run test:coverage') }
            }
            post {
                always {
                    archiveArtifacts artifacts: 'coverage/**', allowEmptyArchive: true
                }
            }
        }

        stage('Build (prisma generate + tsc)') {
            steps {
                script { inNode('npm run build') }
            }
        }

        stage('SonarQube (local)') {
            when { expression { return params.RUN_SONAR } }
            steps {
                script {
                    // withSonarQubeEnv toma la URL y el token del servidor configurado en Jenkins
                    // (Manage Jenkins > System > SonarQube servers) y los deja en SONAR_HOST_URL / SONAR_AUTH_TOKEN.
                    // Es obligatorio para que la siguiente etapa (Quality Gate) funcione.
                    withSonarQubeEnv(params.SONARQUBE_JENKINS_SERVER) {
                        def scan = 'npx --yes @sonar/scan -Dsonar.host.url=$SONAR_HOST_URL -Dsonar.token=$SONAR_AUTH_TOKEN -Dsonar.scm.revision=$GIT_COMMIT'
                        def opts = '--add-host=host.docker.internal:host-gateway -e GIT_COMMIT -e SONAR_HOST_URL -e SONAR_AUTH_TOKEN'
                        if (params.SONAR_DOCKER_NETWORK?.trim()) {
                            opts += " --network ${params.SONAR_DOCKER_NETWORK.trim()}"
                        }
                        inNode(scan, opts)
                    }
                }
            }
        }

        stage('Quality Gate') {
            when { expression { return params.RUN_SONAR } }
            steps {
                // Requiere el plugin "SonarQube Scanner" y el webhook configurado en SonarQube
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Docker build & push') {
            when {
                expression {
                    // Multibranch usa BRANCH_NAME; un Pipeline normal usa GIT_BRANCH (origin/main)
                    return env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main'
                }
            }
            steps {
                script {
                    env.SHORT_SHA = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    def buildArgs = ''
                    if (params.PUSH_IMAGE) {
                        // Credencial tipo "Username with password" de Docker Hub
                        withCredentials([usernamePassword(credentialsId: 'dockerhub-credentials',
                                                          usernameVariable: 'DOCKER_USER',
                                                          passwordVariable: 'DOCKER_PASS')]) {
                            sh """
                                IMAGE="\$DOCKER_USER/\$IMAGE_NAME"
                                docker build ${buildArgs} -t "\$IMAGE:\$SHORT_SHA" -t "\$IMAGE:latest" .
                                echo "\$DOCKER_PASS" | docker login -u "\$DOCKER_USER" --password-stdin
                                docker push "\$IMAGE:\$SHORT_SHA"
                                docker push "\$IMAGE:latest"
                                docker logout
                            """
                        }
                    } else {
                        echo 'PUSH_IMAGE=false: se construye la imagen solo en local, sin publicar.'
                        sh """
                            docker build ${buildArgs} -t "\$IMAGE_NAME:\$SHORT_SHA" -t "\$IMAGE_NAME:latest" .
                        """
                    }
                }
            }
            post {
                always {
                    sh 'docker image prune -f || true'
                }
            }
        }
    }

    post {
        success { echo '✅ Pipeline completado correctamente.' }
        failure { echo '❌ El pipeline falló. Revisa los logs de la etapa fallida.' }
        cleanup { echo 'Pipeline finalizado.' }
    }
}
