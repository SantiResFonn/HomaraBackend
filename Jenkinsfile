
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
                     description: 'Ejecutar análisis de SonarCloud')
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

        stage('SonarCloud') {
            when { expression { return params.RUN_SONAR } }
            steps {
                // Credencial tipo "Secret text" con el token de SonarCloud
                withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
                    script {
                        inNode('npx --yes @sonar/scan -Dsonar.host.url=https://sonarcloud.io -Dsonar.token=$SONAR_TOKEN -Dsonar.scm.revision=$GIT_COMMIT',
                               '-e SONAR_TOKEN -e GIT_COMMIT')
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
                }
                // Credencial tipo "Username with password" de Docker Hub
                withCredentials([usernamePassword(credentialsId: 'dockerhub-credentials',
                                                  usernameVariable: 'DOCKER_USER',
                                                  passwordVariable: 'DOCKER_PASS')]) {
                    sh '''
                        IMAGE="$DOCKER_USER/$IMAGE_NAME"
                        docker build \
                          -t "$IMAGE:$SHORT_SHA" \
                          -t "$IMAGE:latest" .
                    '''
                    script {
                        if (params.PUSH_IMAGE) {
                            sh '''
                                IMAGE="$DOCKER_USER/$IMAGE_NAME"
                                echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                                docker push "$IMAGE:$SHORT_SHA"
                                docker push "$IMAGE:latest"
                                docker logout
                            '''
                        } else {
                            echo 'PUSH_IMAGE=false: se omite la publicación en Docker Hub.'
                        }
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

