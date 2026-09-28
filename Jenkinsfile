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
        string(name: 'SONAR_HOST_URL',
               defaultValue: 'http://host.docker.internal:9000',
               description: 'URL del SonarQube local')
        string(name: 'SONAR_DOCKER_NETWORK',
               defaultValue: '',
               description: 'Red de Docker donde corre SonarQube (opcional). Si se indica, usa SONAR_HOST_URL tipo http://<contenedor>:9000')
        string(name: 'SONAR_TOKEN_CREDENTIAL_ID',
               defaultValue: '',
               description: 'ID de credencial (Secret text) con el token. Dejar vacío si no se usa token')
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
                    // host.docker.internal permite al contenedor de Node llegar al SonarQube del host
                    def scan = "npx --yes @sonar/scan -Dsonar.host.url=${params.SONAR_HOST_URL} -Dsonar.scm.revision=\$GIT_COMMIT"
                    def opts = '--add-host=host.docker.internal:host-gateway -e GIT_COMMIT'
                    if (params.SONAR_DOCKER_NETWORK?.trim()) {
                        opts += " --network ${params.SONAR_DOCKER_NETWORK.trim()}"
                    }
                    if (params.SONAR_TOKEN_CREDENTIAL_ID?.trim()) {
                        // Solo si tu SonarQube exige autenticación: credencial tipo "Secret text"
                        withCredentials([string(credentialsId: params.SONAR_TOKEN_CREDENTIAL_ID, variable: 'SONAR_TOKEN')]) {
                            inNode(scan + ' -Dsonar.token=$SONAR_TOKEN', opts + ' -e SONAR_TOKEN')
                        }
                    } else {
                        inNode(scan, opts)
                    }
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
